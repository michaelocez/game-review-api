import {Request, Response} from "express";
import {validate} from "../services/validator";
import {hash} from "../services/passwords";
import * as users from "../models/user.model";
import * as schemas from '../resources/schemas.json'
import Logger from '../../config/logger';
import bcrypt from "bcrypt";
import randToken from "rand-token";



const register = async (req: Request, res: Response): Promise<void> => {
    Logger.http(`POST create user with valid email and password ${req.body.email}`)

    const validation = await validate(schemas.user_register, req.body);
    if (validation !== true) {
        res.statusMessage = `Bad Request: ${validation.toString()}`;
        res.status(400).send();
        return;
    }

    const {email, firstName, lastName, password} = req.body;

    try {
        if (await users.emailExists(email)) {
            Logger.warn(`${email} is already in use`);
            res.status(403).send();
            return;
        }
        const hashedPassword = await hash(password);
        const result = await users.insert(email, firstName, lastName, hashedPassword);
        Logger.info(`User registered successfully: ${email} (ID: ${result.insertId})`)
        res.status(201).send({userId: result.insertId});
    } catch (err) {
        Logger.error(err);
        res.status(500).send(`ERROR creating user ${email}: ${err}`);
    }
};

const login = async (req: Request, res: Response): Promise<void> => {
    Logger.http(`POST login with valid email and password ${req.body.email}`)

    const validation = await validate(schemas.user_login, req.body);
    if (validation !== true) {
        res.statusMessage = `Bad Request: ${validation.toString()}`;
        res.status(400).send();
        return;
    }

    const { email, password } = req.body;


    try {
        // Get user by email
        const user = await users.getUserByEmail(email);
        if (!user) {
            res.status(401).send(`Incorrect email or password`);
            return;
        }

        // Compare given pw with stored hash
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).send(`Unauthorized. Incorrect email/password`);
            return;
        }

        // Gen auth token and store in db
        const authToken = randToken.generate(32);
        await users.storeAuthToken(user.id, authToken);
        res.status(200).send({userId: user.id, token: authToken});
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const logout = async (req: Request, res: Response): Promise<void> => {
    Logger.http(`POST logout by removing auth token ${req.body.email}`)

    const authToken = req.header("X-Authorization");
    // check if token missing from db
    if (!authToken) {
        res.status(401).send(`Unauthorized. Incorrect email/password`);
        return;
    }
    // check for invalid info
    if (typeof authToken !== "string") {
        res.status(400).send(`Bad Request. Invalid information`);
    }

    try {
        // remove token from db
        await users.removeAuthToken(authToken);
        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.status(500).send(`Internal Server Error`);
    }
}

const view = async (req: Request, res: Response): Promise<void> => {
    Logger.http(`GET user with id: ${req.params.id}`)

    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
        res.status(400).send(`Invalid User ID`);
        return;
    }

    try {
        const user = await users.getUserById(userId);
        if (!user) {
            res.status(404).send(`User not found`);
            return;
        }
        // get auth token from request header
        const authToken = req.header("X-Authorization");
        let reqUser = null;
        if (authToken) {
            reqUser = await users.getUserByAuthToken(authToken);
        }
        // only show email if requester id is same as user
        if (!reqUser || reqUser.id !== userId) {
            delete user.email; // hide email
        }
        res.status(200).send(user);
    } catch (err) {
        Logger.error(err);
        res.status(500).send(`ERROR getting user ${userId}: ${err}`);
    }
};

const update = async (req: Request, res: Response): Promise<void> => {
    Logger.http(`PATCH change user details${req.params.id}`);

    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
        res.status(400).send(`Invalid User ID`);
        return;
    }
    try {
        const validation = await validate(schemas.user_edit, req.body);
        if (validation !== true) {
            res.status(400).send(`${validation.toString()}`);
            return;
        }
        // get auth token and check authentication
        const authToken = req.header("X-Authorization");
        if (!authToken) {
            res.status(401).send(`Unauthorized: No token`);
            return;
        }

        const reqUser = await users.getUserByAuthToken(authToken);
        if (!reqUser) {
            res.status(401).send(`Unauthorized: Invalid token`);
            return;
        }
        // user can only update their own profile
        if (reqUser.id !== userId) {
            res.status(403).send(`Forbidden: Cannot edit another user`);
            return;
        }

        // check if user exists
        const existingUser = await users.getUserById(userId);
        if (!existingUser) {
            res.status(404).send(`User not found`);
            return;
        }
        // check if email is being updated and already exists
        if (req.body.email && req.body.email !== existingUser.email) {
            if (await users.emailExists(req.body.email)) {
                res.status(403).send(`Email already in use`);
                return;
            }
        }

        // check if password is being changed and verify current password
        if (req.body.password) {
            if (!req.body.currentPassword) {
                res.status(400).send(`Bad Request: Must provide current Password to change password`);
                return;
            }

            const userWithPassword = await users.getUserByEmail(existingUser.email);
            const isPasswordValid = await bcrypt.compare(req.body.currentPassword, userWithPassword.password);

            if (!isPasswordValid) {
                res.status(401).send(`Unauthorized or Invalid current password`);
                return;
            }

            // prevent updating to the same password
            const isSamePassword = await bcrypt.compare(req.body.password, userWithPassword.password);
            if (isSamePassword) {
                res.status(403).send(`Forbidden: Identical current and new password`);
                return;
            }

            // hash new password
            req.body.password = await bcrypt.hash(req.body.password, 10);
        }

        // apply updates
        await users.updateUser(userId, req.body.firstName, req.body.lastName, req.body.email, req.body.password);

        // retrieve the updated user and return it
        const updatedUser = await users.getUserById(userId);
        res.status(200).send(updatedUser);

    } catch (err) {
        Logger.error(`Error updating user: ${err}`);
        res.status(500).send({ error: "Internal Server Error" });
    }
};

export {register, login, logout, view, update}