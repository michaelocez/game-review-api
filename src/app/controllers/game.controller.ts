import {Request, Response} from "express";
import Logger from "../../config/logger";
import * as games from "../models/game.model";
import * as users from "../models/user.model";

const getAllGames = async (req: Request, res: Response): Promise<void> => {
    Logger.http('GET all games')
    try {
        // Extract query parameters
        const queryData = {
            q: req.query.q as string | undefined,
            genreId: req.query.genreIds ? (Array.isArray(req.query.genreIds) ? req.query.genreIds : (req.query.genreIds as string).split(",")).map(Number) : undefined,
            platformIds: req.query.platformIds ? (Array.isArray(req.query.platformIds) ? req.query.platformIds : (req.query.platformIds as string).split(",")).map(Number) : undefined,
            creatorId: req.query.creatorId ? parseInt(req.query.creatorId as string || req.query.creatorId as string, 10) : undefined,
            ownerId: req.query.ownerId ? parseInt(req.query.ownerId as string, 10) : undefined,
            price: req.query.price ? parseInt(req.query.price as string, 10) : undefined,
            sortBy: req.query.sortBy as string | undefined,
            startIndex: req.query.startIndex ? parseInt(req.query.startIndex as string, 10) : undefined,
            count: req.query.count ? parseInt(req.query.count as string, 10) : undefined,
            reviewId: req.query.reviewerId ? parseInt(req.query.reviewerId as string, 10) : undefined,
        };

        // Check if creator id is a non-negative valid number
        if (queryData.creatorId !== undefined && (isNaN(queryData.creatorId) || queryData.creatorId < 0)) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Check if genre id is a non-negative valid number
        if (queryData.genreId && queryData.genreId.some(isNaN)) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Check if price is a non-negative valid number
        if (queryData.price !== undefined && queryData.price < 0) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Check if sort by field contains valid sorting options
        const validSortOptions = ["ALPHABETICAL_ASC", "ALPHABETICAL_DESC", "PRICE_ASC", "PRICE_DESC", "RATING_ASC", "RATING_DESC", "CREATED_DESC"];
        if (queryData.sortBy && !validSortOptions.includes(queryData.sortBy)) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Get auth token and check if user is valid, then authenticates
        const authToken = req.header("X-Authorization");
        let reqUser = null;
        if (authToken) {
            reqUser = await users.getUserByAuthToken(authToken);
            if (!reqUser) {
                res.status(401).send(`Unauthorized`);
                return;
            }
        }

        // if ownedByMe is true, make the owner id the user's id, if user is logged in
        if (req.query.ownedByMe) {
            if (!reqUser) {
                res.status(401).send(`Unauthorized`);
                return;
            }
            queryData.ownerId = reqUser.id;
        }

        // Check if platform id is a non-negative valid number
        if (queryData.platformIds && queryData.platformIds.length > 0) {
            const isValidPlatforms = await games.validatePlatformIds(queryData.platformIds);
            if (!isValidPlatforms) {
                res.status(400).send(`Bad Request`);
                return;
            }
        }

        // Get list of games using query data after filters and pagination
        const result = await games.getAllGames(queryData);
        res.status(200).json({ games: result.games, count: result.count }); // Return games and the total count
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const getGame = async(req: Request, res: Response): Promise<void> => {
    Logger.http('GET game by id');

    // Validate gameId is a number
    const gameId = parseInt(req.params.id, 10);
    if (isNaN(gameId)) {
        res.status(400).send(`Invalid game ID`);
        return;
    }

    try {
        const game = await games.getGameById(gameId);

        if (!game) {
            res.status(404).send('Not Found. No game found with id');
            return;
        }
        res.status(200).json(game);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const addGame = async(req: Request, res: Response): Promise<void> => {
    Logger.http('POST Add game');

    try {
        const authToken = req.header("X-Authorization");
        if (!authToken) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Verify user is authenticated
        const user = await users.getUserByAuthToken(authToken);
        if (!user) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        const { title, description, genreId, price, platformIds } = req.body;

        // Validate required fields
        if (!title || !description || !genreId || price === undefined || !Array.isArray(platformIds) || platformIds.length === 0) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Validate description
        if (req.body.description.length > 50) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Validate price
        if (price < 0) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Check if title is unique
        const existingGame = await games.getGameByTitle(title);
        if (existingGame) {
            res.status(403).send(`Forbidden: Game title already exists`);
            return;
        }

        // Validate genreId
        const validGenre = await games.validateGenreId(genreId);
        if (!validGenre) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Validate platformIds
        const validPlatforms = await games.validatePlatformIds(platformIds);
        if (!validPlatforms) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Insert game and retrieve gameId
        const gameId = await games.insertGame(title, description, genreId, price, user.id);

        // Insert game platforms relationship
        await games.insertGamePlatforms(gameId, platformIds);

        res.status(201).json({ gameId });
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}


const editGame = async(req: Request, res: Response): Promise<void> => {
    Logger.http('POST Edit game');

    try {

        // Check if game id is valid
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

        // Check is requesting user auth token is correct
        const reqUser = await users.getUserByAuthToken(authToken);
        if (!reqUser) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Check if game already exists
        const existingGame = await games.getGameById(gameId);
        if (!existingGame) {
            res.status(404).send(`Not Found. No game found with id`);
            return;
        }

        // Check if requesting user id matchs game creator id
        if (existingGame.creatorId !== reqUser.id) {
            res.status(403).send(`Forbidden: Only the creator can edit this game`);
            return;
        }

        const { title, description, genreId, price, platformIds } = req.body;

        // Check if title already exists
        if (title) {
            const titleExists = await games.getGameByTitle(title);
            if (titleExists && title !== existingGame.title) {
                res.status(403).send(`Forbidden: Game title already exists`);
                return;
            }
        }

        // Check if genre id is valid
        if (genreId) {
            const isValidGenre = await games.validateGenreId(genreId);
            if (!isValidGenre) {
                res.status(400).send(`Bad Request`);
                return;
            }
        }

        // Check that platform id is an array and not empty
        if (platformIds && (!Array.isArray(platformIds) || platformIds.length === 0)) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Check if platform ids are valid
        if (platformIds) {
            const isValidPlatforms = await games.validatePlatformIds(platformIds);
            if (!isValidPlatforms) {
                res.status(400).send(`Bad Request`);
                return;
            }
        }

        // Check if price is valid non-negative number
        if (price !== undefined && price < 0) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Make sure atleast one field is being updated
        if (!title && !description && !genreId && !price && !platformIds) {
            res.status(400).send(`Bad Request`);
            return;
        }

        // Update game details
        await games.updateGame(gameId, title, description, genreId, price);

        // Update platform ids if new are given
        if (platformIds) {
            await games.updateGamePlatforms(gameId, platformIds);
        }

        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const deleteGame = async(req: Request, res: Response): Promise<void> => {
    Logger.http('DELETE game');

    try {

        // Check if game id is valid
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

        // Check is requesting user auth token is correct
        const reqUser = await users.getUserByAuthToken(authToken);
        if (!reqUser) {
            res.status(401).send(`Unauthorized`);
            return;
        }

        // Get game creator id from db
        const creatorId = await games.getGameCreator(gameId);
        if (creatorId === null) {
            res.status(404).send(`Not Found. No game found with id`);
            return;
        }

        // Check if requesting user id is same as game creator, if not return 403
        if (creatorId !== reqUser.id) {
            res.status(403).send(`Forbidden: Only the creator of a game may delete it`);
            return;
        }

        // Check if game has review, if so return 403
        if (await games.gameHasReviews(gameId)) {
            res.status(403).send(`Can not delete a game with one or more reviews`);
            return;
        }

        await games.deleteGame(gameId);
        res.status(200).send();
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}


const getGenres = async(req: Request, res: Response): Promise<void> => {
    Logger.http(`GET game genres`)
    try {
        const genres = await games.getGenres();
        res.status(200).json(genres);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}

const getPlatforms = async(req: Request, res: Response): Promise<void> => {
    Logger.http(`GET game platforms`)
    try {
        const platforms = await games.getPlatforms();
        res.status(200).json(platforms);
    } catch (err) {
        Logger.error(err);
        res.statusMessage = "Internal Server Error";
        res.status(500).send();
    }
}


export {getAllGames, getGame, addGame, editGame, deleteGame, getGenres, getPlatforms};