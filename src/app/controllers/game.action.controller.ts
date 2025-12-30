import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as gameActionsModel from "../models/game.action.model";
import * as games from "../models/game.model";
import * as users from "../models/user.model";


const addGameToWishlist = async(req: Request, res: Response): Promise<void> => {
    Logger.http(`POST Add game to wishlist`);

    // Validate game ID
    const gameId = parseInt(req.params.id, 10);
    if (isNaN(gameId)) {
        res.status(400).send(`Bad Request`);
        return;
    }

    // Check if auth token is provided
    const authToken = req.header("X-Authorization");
    if (!authToken) {
        res.status(401).send(`Unauthorized`);
        return;
    }

    try {
        // Get requesting user
        const reqUser = await users.getUserByAuthToken(authToken);
        if (!reqUser) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Check if game exists
        const gameExists = await gameActionsModel.gameExists(gameId);
        if (!gameExists) {
            res.status(404).send(`Not Found: No game with id`);
            return;
        }

        // Check if the user is the creator
        const gameCreatorId = await games.getGameCreator(gameId);
        if (gameCreatorId === reqUser.id) {
            res.status(403).send(`Forbidden: Can not wishlist a game you created`);
            return;
        }

        // Check if the user already owns the game
        const isOwned = await gameActionsModel.isGameOwned(reqUser.id, gameId);
        if (isOwned) {
            res.status(403).send(`Forbidden: Can not wishlist a game you have marked as owned.`);
            return;
        }

        // Add game to wishlist
        await gameActionsModel.wishlistGame(reqUser.id, gameId);
        res.status(200).send(`OK`);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const removeGameFromWishlist = async(req: Request, res: Response): Promise<void> => {
    Logger.http(` DELETE Remove game from wishlist`);


    try {
        // Validate game ID
        const gameId = parseInt(req.params.id, 10);
        if (isNaN(gameId)) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Check if auth token is given
        const authToken = req.header("X-Authorization");
        if (!authToken) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Validate user
        const reqUser = await users.getUserByAuthToken(authToken);
        if (!reqUser) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Check if game exists
        const gameExists = await games.getGameById(gameId);
        if (!gameExists) {
            res.status(404).send(`Not Found: No game with id`);
            return;
        }

        // Check if the game is wishlisted
        const isWishlisted = await gameActionsModel.isGameWishlisted(reqUser.id, gameId);
        if (!isWishlisted) {
            res.status(403).send(`Forbidden: Can not unwishlist a game you do not currently wishlist`);
            return;
        }

        // Remove game from wishlist
        await gameActionsModel.removeGameFromWishlist(reqUser.id, gameId);
        res.status(200).send(`OK`);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const addGameToOwned = async(req: Request, res: Response): Promise<void> => {
    Logger.http(`POST Mark game as owned`);

    try {
        // Validate game ID
        const gameId = parseInt(req.params.id, 10);
        if (isNaN(gameId)) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Check if auth token is given
        const authToken = req.header("X-Authorization");
        if (!authToken) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Validate user
        const reqUser = await users.getUserByAuthToken(authToken);
        if (!reqUser) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Check if game exists
        const game = await games.getGameById(gameId);
        if (!game) {
            res.status(404).send(`Not Found: No game with id`);
            return;
        }

        // A user can not mark a game they created as owned
        if (game.creatorId === reqUser.id) {
            res.status(403).send(`Forbidden: Can not mark a game you created as owned`);
            return;
        }

        // Remove the game from wishlist
        await gameActionsModel.removeGameFromWishlist(reqUser.id, gameId);

        // Mark game as owned
        await gameActionsModel.addGameToOwned(reqUser.id, gameId);

        res.status(200).send(`OK`);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const removeGameFromOwned = async(req: Request, res: Response): Promise<void> => {
    Logger.http(`DELETE Unmark game as owned`);

    try {
        // Validate game ID
        const gameId = parseInt(req.params.id, 10);
        if (isNaN(gameId)) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Check if auth token is given
        const authToken = req.header("X-Authorization");
        if (!authToken) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Validate user
        const reqUser = await users.getUserByAuthToken(authToken);
        if (!reqUser) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Check if game exists
        const game = await games.getGameById(gameId);
        if (!game) {
            res.status(404).send(`Not Found: No game with id`);
            return;
        }

        // Check if the game is currently owned
        const isOwned = await gameActionsModel.isGameOwned(reqUser.id, gameId);
        if (!isOwned) {
            res.status(403).send(`Forbidden. Cannot unmark a game you do not currently own`);
            return;
        }

        // Remove game from owned list
        await gameActionsModel.removeGameFromOwned(reqUser.id, gameId);

        res.status(200).send(`OK`);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

export {addGameToWishlist, removeGameFromWishlist, addGameToOwned, removeGameFromOwned};