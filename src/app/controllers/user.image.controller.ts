import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as userImageModel from "../models/user.image.model";
import * as users from "../models/user.model";

const getImage = async (req: Request, res: Response): Promise<void> => {
    Logger.http(`GET user ${req.params.id} profile image`);

    // invalid user id
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
        res.status(400).send(`Bad Request`);
        return;
    }

    try {
        const imageFilename = await userImageModel.getImageFilename(userId);
        if (!imageFilename) {
            res.status(404).send(`Not Found. No user with specified ID, or user has no image`);
            return;
        }

        // determine MIME type based on the filename
        const extension = imageFilename.split(".").pop()?.toLowerCase();
        let mimeType = "image/png";
        if (extension === "jpg" || extension === "jpeg") mimeType = "image/jpeg";
        if (extension === "gif") mimeType = "image/gif";

        res.setHeader("Content-Type", mimeType); // set response header to correct image MIME type

        res.status(200).end(); // end without sending a body

    } catch (err) {
        Logger.error(`Error retrieving user image: ${err}`);
        res.status(500).send({ error: "Internal Server Error" });
    }
};

const setImage = async (req: Request, res: Response): Promise<void> => {
    Logger.http(`PUT: update user ${req.params.id} profile image`);

    // invalid user id
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
        res.status(404).send(`Bad Request: No such user with ID given`);
        return;
    }
    const authToken = req.header("X-Authorization");
    if (!authToken) {
        res.status(401).send(`Unauthorized`);
        return;
    }

    try {
        const reqUser = await users.getUserByAuthToken(authToken);
        if (!reqUser) {
            res.status(401).send(`Unauthorized`);
            return;
        }
        if (reqUser.id !== userId) {
            res.status(403).send(`Forbidden: Can not change another user's profile photo`);
            return;
        }
        const userExists = await users.getUserById(userId);
        if (!userExists) {
            res.status(404).send(`Not found. No such user with ID given`);
            return;
        }
        if (!["image/png", "image/jpeg", "image/gif"].includes(req.headers["content-type"])) {
            res.status(400).send(`Bad Request: Invalid image type`);
            return;
        }
        // check if user already has an image
        const existingImage = await userImageModel.getImageFilename(userId);
        const isNewUpload = !existingImage; // if no existing image, make it new upload

        // generate new filename
        const extension = req.headers["content-type"].split("/")[1] || "png";
        const newImageFilename = `${userId}.${extension}`;

        // update DB
        await userImageModel.setImageFilename(userId, newImageFilename);

        // return status code
        if (isNewUpload) {
            res.status(201).send(`Created: New image created`);
        } else {
            res.status(200).send(`OK: Image Updated`);
        }
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const deleteImage = async (req: Request, res: Response): Promise<void> => {
    Logger.http(`PUT Delete ${req.params.id}'s profile picture`);

    // invalid user id
    const userId = parseInt(req.params.id, 10);
    if (isNaN(userId)) {
        res.status(400).send(`Bad Request`);
        return;
    }

    const authToken = req.header("X-Authorization");
    if (!authToken) {
        res.status(401).send(`Unauthorized`);
        return;
    }
    try {
        const reqUser = await users.getUserByAuthToken(authToken);
        if (!reqUser) {
            res.status(401).send(`Unauthorized`);
            return;
        }
        if (reqUser.id !== userId) {
            res.status(403).send(`Forbidden: Can not delete another user's profile photo`);
            return;
        }

        // Check if user exists
        const userExists = await users.getUserById(userId);
        if (!userExists) {
            res.status(404).send(`Not Found: No such user with ID given`);
            return;
        }

        // remove filename from DB
        await userImageModel.deleteImageFilename(userId);

        res.status(200).send(`OK`);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

export {getImage, setImage, deleteImage}
