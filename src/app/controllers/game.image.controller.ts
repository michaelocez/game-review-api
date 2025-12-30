import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as gameImageModel from "../models/game.image.model";
import * as games from "../models/game.model";
import * as users from "../models/user.model";



const getImage = async (req: Request, res: Response): Promise<void> => {
    Logger.http(`GET game cover image`);

    // Validate game ID
    const gameId = parseInt(req.params.id, 10);
    if (isNaN(gameId)) {
        res.status(400).send(`Bad Request`);
        return;
    }

    try {

        // Check if game exists
        const gameExists = await gameImageModel.gameExists(gameId);
        if (!gameExists) {
            res.status(404).send(`Not Found: No game with id`);
            return;
        }

        // Check if game has image filename in db
        const imageFilename = await gameImageModel.getGameImageFilename(gameId);
        if (!imageFilename) {
            res.status(404).send(`Not Found. No Game has no image`);
            return;
        }

        const filePath = await gameImageModel.getGameImageFilePath(imageFilename);
        if (!filePath) {
            res.status(404).send(`Not Found. Image file missing`);
            return;
        }

        // Determine MIME type based on the filename
        const extension = imageFilename.split(".").pop()?.toLowerCase();
        let mimeType = "image/png";
        if (extension === "jpg" || extension === "jpeg") mimeType = "image/jpeg";
        if (extension === "gif") mimeType = "image/gif";

        // Set response headers and send the image
        res.setHeader("Content-Type", mimeType);
        res.sendFile(filePath);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const setImage = async (req: Request, res: Response): Promise<void> => {
    Logger.http(`PUT Update game cover image`);

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

    try {
        const reqUser = await users.getUserByAuthToken(authToken);
        if (!reqUser) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Check if game exists and get creator
        const gameCreatorId = await games.getGameCreator(gameId);
        if (!gameCreatorId) {
            res.status(404).send(`Not Found. No game found with id`);
            return;
        }

        // Check if the user is the creator
        if (reqUser.id !== gameCreatorId) {
            res.status(403).send(`Forbidden. Only the creator of a game can change the hero image`);
            return;
        }

        // Validate content type
        const allowedMimeTypes = ["image/png", "image/jpeg", "image/gif"];
        const contentType = req.headers["content-type"];
        if (!allowedMimeTypes.includes(contentType)) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Get game details
        const game = await games.getGameById(gameId);
        if (!game) {
            res.status(404).send(`Not Found. No game found with id`);
            return;
        }

        const extension = contentType.split("/")[1] || "png";
        const newImageFilename = await gameImageModel.saveGameImage(gameId, req.body, extension);

        const existingImage = await gameImageModel.getGameImageFilename(gameId);
        if (existingImage) {
            await gameImageModel.deleteOldImage(existingImage);
        }

        await gameImageModel.setGameImageFilename(gameId, newImageFilename);

        // Check if a previous image exists and return appropriate code
        const isNewUpload = !existingImage;
        if (isNewUpload) {
            res.status(201).send("Created. Image added");
        } else {
            res.status(200).send("OK. Image updated");
        }
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}


export {getImage, setImage};