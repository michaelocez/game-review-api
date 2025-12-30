import { getPool } from "../../config/db";
import Logger from "../../config/logger";

const getGenres = async (): Promise<{ genreId: number; name: string }[]> => {
    Logger.info(`Retrieving all game genres`);
    const conn = await getPool().getConnection();
    const query = `SELECT id AS genreId, name FROM genre ORDER BY id`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
}

const getPlatforms = async (): Promise<{ platformId: number; name: string }[]> => {
    Logger.info(`Retrieving all game platforms`);
    const conn = await getPool().getConnection();
    const query = `SELECT id AS platformId, name FROM platform ORDER BY FIELD(id, 5, 4, 1, 3, 2)`;
    const [rows] = await conn.query(query);
    await conn.release();
    return rows;
}

const getAllGames = async (queryData: { q?: string; genreId?: number[]; platformIds?: number[];
    ownerId?: number; price?: number; reviewId?: number; sortBy?: string; startIndex?: number; count?: number;
    }): Promise<{ games: any[], count: number }> => {

    Logger.info(`Retrieving all games with filters`);

    const conn = await getPool().getConnection();

    // Base query to get game details
    let query = `SELECT g.id AS gameId, g.title, g.genre_id AS genreId, g.creation_date AS creationDate,
               g.creator_id AS creatorId, u.first_name AS creatorFirstName, u.last_name AS creatorLastName, g.price,
               COALESCE(AVG(r.rating), 0) AS rating, COALESCE(GROUP_CONCAT(DISTINCT gp.platform_id ORDER BY
               gp.platform_id), '') AS platformIds FROM game g JOIN user u ON g.creator_id = u.id
               LEFT JOIN game_review r ON g.id = r.game_id LEFT JOIN game_platforms gp ON g.id = gp.game_id
               WHERE 1=1`;

    // Separate count query to track total games matching filters
    let countQuery = `SELECT COUNT(DISTINCT g.id) AS total FROM game g WHERE 1=1`;

    // Arrays to hold query parameters for filtering
    const params: any[] = [];
    const countParams: any[] = [];

    // Search filter
    if (queryData.q) {
        query += ` AND (g.title LIKE ? OR g.description LIKE ?)`;
        countQuery += ` AND (g.title LIKE ? OR g.description LIKE ?)`;
        params.push(`%${queryData.q}%`, `%${queryData.q}%`);
        countParams.push(`%${queryData.q}%`, `%${queryData.q}%`);
    }

    // Genre filter
    if (queryData.genreId?.length) {
        const placeholders = queryData.genreId.map(() => "?").join(",");
        query += ` AND g.genre_id IN (${placeholders})`;
        countQuery += ` AND g.genre_id IN (${placeholders})`;
        queryData.genreId.forEach(id => {
            params.push(id);
            countParams.push(id);
        });
    }

    // Platform filter
    if (queryData.platformIds?.length) {
        query += ` AND g.id IN (
            SELECT game_id FROM game_platforms WHERE platform_id IN (${queryData.platformIds.join(",")})
        )`;
        countQuery += ` AND g.id IN (
            SELECT game_id FROM game_platforms WHERE platform_id IN (${queryData.platformIds.join(",")})
        )`;
    }

    // Price filter
    if (queryData.price !== undefined) {
        query += ` AND g.price <= ?`;
        countQuery += ` AND g.price <= ?`;
        params.push(queryData.price);
        countParams.push(queryData.price);
    }

    // Owner filter
    if (queryData.ownerId) {
        query += ` AND g.id IN (SELECT game_id FROM owned WHERE user_id = ?)`;
        countQuery += ` AND g.id IN (SELECT game_id FROM owned WHERE user_id = ?)`;
        params.push(queryData.ownerId);
        countParams.push(queryData.ownerId);
    }

    // Review filter
    if (queryData.reviewId) {
        query += ` AND EXISTS (
            SELECT 1 FROM game_review WHERE game_id = g.id AND user_id = ?
        )`;
        countQuery += ` AND EXISTS (
            SELECT 1 FROM game_review WHERE game_id = g.id AND user_id = ?
        )`;
        params.push(queryData.reviewId);
        countParams.push(queryData.reviewId);
    }

    // Group by game id
    query += ` GROUP BY g.id`;

    // Sorting options
    const sortOptions: { [key: string]: string } = {
        ALPHABETICAL_ASC: "g.title ASC",
        ALPHABETICAL_DESC: "g.title DESC",
        PRICE_ASC: "g.price ASC",
        PRICE_DESC: "g.price DESC",
        RATING_ASC: "rating ASC",
        RATING_DESC: "rating DESC",
        CREATED_DESC: "g.creation_date DESC",
    };

    // Apply sorting based on given sortBy parameter, created_asc as default
    query += ` ORDER BY ${sortOptions[queryData.sortBy] || "g.creation_date ASC"}, g.id ASC`;

    // Pagination
    if (queryData.startIndex !== undefined && queryData.count !== undefined) {
        query += ` LIMIT ?, ?`;
        params.push(queryData.startIndex, queryData.count);
    }

    // Execute queries
    const [[{ total }]] = await conn.query(countQuery, countParams);
    const [rows] = await conn.query(query, params);

    // Format response
    rows.forEach((row: any) => {
        row.platformIds = row.platformIds ? row.platformIds.split(",").map(Number) : [];
        row.rating = parseFloat(row.rating);
    });

    await conn.release();
    return { games: rows, count: total };
}


const validatePlatformIds = async (platformIds: number[]): Promise<boolean> => {
    Logger.info(`Validating platform ID`);

    const conn = await getPool().getConnection();
    const [validPlatforms] = await conn.query(`SELECT id FROM platform WHERE id IN (?)`, [platformIds]);

    const validPlatformIds = new Set(validPlatforms.map((p: any) => p.id));
    const invalidPlatforms = platformIds.filter(id => !validPlatformIds.has(id));

    await conn.release();
    return invalidPlatforms.length === 0;
}

const getGameById = async (gameId: number): Promise<any | null> => {
    Logger.info(`Get game with given game id`);
    const conn = await getPool().getConnection();

    // Get game details and combine related data
    const gameQuery = `SELECT g.id AS gameId, g.title, g.description, g.genre_id AS genreId, g.creation_date
                    AS creationDate, g.creator_id AS creatorId, u.first_name AS creatorFirstName, u.last_name
                    AS creatorLastName, g.price, COALESCE(AVG(r.rating), 0) AS rating, (SELECT COUNT(*) FROM wishlist
                    WHERE game_id = g.id) AS numberOfWishlists, (SELECT COUNT(*) FROM owned WHERE game_id = g.id)
                    AS numberOfOwners FROM game g JOIN user u ON g.creator_id = u.id LEFT JOIN game_review r
                    ON g.id = r.game_id WHERE g.id = ? GROUP BY g.id`;

    // Get associated platform IDs
    const platformsQuery = `SELECT platform_id FROM game_platforms WHERE game_id = ?`;

    const [gameRows] = await conn.query(gameQuery, [gameId]);
    const [platformRows] = await conn.query(platformsQuery, [gameId]);

    await conn.release();

    if (gameRows.length === 0) {
        return null; // No game found
    }

    const game = gameRows[0];
    game.platformIds = platformRows.map((row: any) => row.platform_id);
    game.rating = parseFloat(game.rating);

    return game;
}

const getGameByTitle = async (title: string): Promise<boolean> => {
    Logger.info(`Check if given game title exists: ${title}`);
    const conn = await getPool().getConnection();
    const query = `SELECT id FROM game WHERE title = ?`;
    const [rows] = await conn.query(query, [title]);
    await conn.release();
    return rows.length > 0;
}

const validateGenreId = async (genreId: number): Promise<boolean> => {
    Logger.info(`Validate genre ID: ${genreId}`);
    const conn = await getPool().getConnection();
    const query = `SELECT id FROM genre WHERE id = ?`;
    const [rows] = await conn.query(query, [genreId]);
    await conn.release();
    return rows.length > 0;
}

const insertGame = async (title: string, description: string, genreId: number, price: number, creatorId: number): Promise<number> => {
    Logger.info(`Insert new game titled: ${title}`);
    const conn = await getPool().getConnection();
    const query = `INSERT INTO game (title, description, genre_id, price, creator_id, creation_date) VALUES (?, ?, ?, ?, ?, NOW())`;
    const [result] = await conn.query(query, [title, description, genreId, price, creatorId]);
    await conn.release();
    return result.insertId;
}

const insertGamePlatforms = async (gameId: number, platformIds: number[]): Promise<void> => {
    Logger.info(`Link game platforms for gameId: ${gameId}`);
    const conn = await getPool().getConnection();
    const values = platformIds.map(platformId => [gameId, platformId]);
    await conn.query(`INSERT INTO game_platforms (game_id, platform_id) VALUES ?`, [values]);
    await conn.release();
}

const updateGame = async (gameId: number, title?: string, description?: string, genreId?: number, price?: number): Promise<void> => {
    Logger.info(`Updating game ${gameId}`);
    const conn = await getPool().getConnection();

    // Build SQL query
    const fields = [];
    const values: any[] = [];

    if (title !== undefined) {
        fields.push("title = ?");
        values.push(title);
    }
    if (description !== undefined) {
        fields.push("description = ?");
        values.push(description);
    }
    if (genreId !== undefined) {
        fields.push("genre_id = ?");
        values.push(genreId);
    }
    if (price !== undefined) {
        fields.push("price = ?");
        values.push(price);
    }

    values.push(gameId); // Add gameId at the end for WHERE condition
    const query = `UPDATE game SET ${fields.join(", ")} WHERE id = ?`;

    await conn.query(query, values);
    await conn.release();
}

const updateGamePlatforms = async (gameId: number, platformIds: number[]): Promise<void> => {
    Logger.info(`Updating platforms for game ${gameId}`);
    const conn = await getPool().getConnection();

    // Remove old platforms
    await conn.query(`DELETE FROM game_platforms WHERE game_id = ?`, [gameId]);

    // Insert new platforms
    const values = platformIds.map(platformId => [gameId, platformId]);
    if (values.length > 0) {
        await conn.query(`INSERT INTO game_platforms (game_id, platform_id) VALUES ?`, [values]);
    }

    await conn.release();
}

const getGameCreator = async (gameId: number): Promise<number | null> => {
    Logger.info(`Checking creator of game ID: ${gameId}`);
    const conn = await getPool().getConnection();
    const query = `SELECT creator_id FROM game WHERE id = ?`;
    const [rows] = await conn.query(query, [gameId]);
    await conn.release();
    return rows.length ? rows[0].creator_id : null;
}


const gameHasReviews = async (gameId: number): Promise<boolean> => {
    Logger.info(`Checking if game ID ${gameId} has reviews`);
    const conn = await getPool().getConnection();
    const query = `SELECT COUNT(*) AS count FROM game_review WHERE game_id = ?`;
    const [rows] = await conn.query(query, [gameId]);
    await conn.release();
    return rows[0].count > 0;
}

const deleteGame = async (gameId: number): Promise<void> => {
    Logger.info(`Deleting game with ID: ${gameId}`);
    const conn = await getPool().getConnection();

    // Make sure that all deletions happen, if a step fails rollback
    await conn.beginTransaction();
    await conn.query(`DELETE FROM wishlist WHERE game_id = ?`, [gameId]);
    await conn.query(`DELETE FROM owned WHERE game_id = ?`, [gameId]);
    await conn.query(`DELETE FROM game WHERE id = ?` [gameId]);
    await conn.commit(); // Commit transaction to delete all at once

    await conn.release();
}


export { getGenres, getPlatforms, getAllGames, validatePlatformIds, getGameById, getGameByTitle, validateGenreId,
    insertGame, insertGamePlatforms, updateGame, updateGamePlatforms, getGameCreator, gameHasReviews, deleteGame }
