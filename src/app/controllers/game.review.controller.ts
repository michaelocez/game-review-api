import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as gameReview from "../models/game.review.model"
import * as games from "../models/game.model"
import * as users from "../models/user.model"


const getGameReviews = async(req: Request, res: Response): Promise<void> => {
    Logger.http(`GET reviews for game`);

    // Validate game ID
    const gameId = parseInt(req.params.id, 10);
    if (isNaN(gameId)) {
        res.status(400).send(`Bad Request`);
        return;
    }

    try {
        // Check if the game exists
        const gameExists = await games.getGameById(gameId);
        if (!gameExists) {
            res.status(404).send(`Not Found. No game found with id`);
            return;
        }

        const reviews = await gameReview.getReviewsForGame(gameId);
        res.status(200).json(reviews);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const addGameReview = async(req: Request, res: Response): Promise<void> => {
    Logger.http(`POST Review for game`);

    const gameId = parseInt(req.params.id, 10);
    if (isNaN(gameId)) {
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

        // Check if game exists
        const game = await games.getGameById(gameId);
        if (!game) {
            res.status(404).send(`Not Found. No game found with id`);
            return;
        }

        // User cannot review their own game
        if (game.creatorId === reqUser.id) {
            res.status(403).send(`Forbidden: Cannot review your own game.`);
            return;
        }

        // Check if the user has already reviewed the game
        const hasReviewed = await gameReview.hasUserReviewedGame(gameId, reqUser.id);
        if (hasReviewed) {
            res.status(403).send(`Forbidden: Can only review a game once.`);
            return;
        }

        const { rating, review } = req.body;

        // Validate rating
        if (typeof rating !== "number" || rating < 1 || rating > 10) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Validate review text (optional)
        if (review !== undefined && typeof review !== "string") {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Make sure review is less than 512 chars, match db varchar512
        if (review && review.length > 512) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Insert the review
        await gameReview.addReview(gameId, reqUser.id, rating, review);

        res.status(201).send('Created');
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}




export {getGameReviews, addGameReview};