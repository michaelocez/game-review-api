import { getPool } from "../../config/db";
import Logger from "../../config/logger";

const gameExists = async (gameId: number): Promise<boolean> => {
    Logger.info(`Checking if game ${gameId} exists`);
    const conn = await getPool().getConnection();
    const query = `SELECT id FROM game WHERE id = ?`;
    const [rows] = await conn.query(query, [gameId]);
    await conn.release();
    return rows.length > 0;
}

const isGameOwned = async (userId: number, gameId: number): Promise<boolean> => {
    Logger.info(`Checking if user ${userId} owns game ${gameId}`);
    const conn = await getPool().getConnection();
    const query = `SELECT id FROM owned WHERE user_id = ? AND game_id = ?`;
    const [rows] = await conn.query(query, [userId, gameId]);
    await conn.release();
    return rows.length > 0;
}

const wishlistGame = async (userId: number, gameId: number): Promise<void> => {
    Logger.info(`User ${userId} wishlisting game ${gameId}`);
    const conn = await getPool().getConnection();
    const query = `INSERT INTO wishlist (user_id, game_id) VALUES (?, ?)`;
    await conn.query(query, [userId, gameId]);
    await conn.release();
}

const isGameWishlisted = async (userId: number, gameId: number): Promise<boolean> => {
    Logger.info(`Checking if user ${userId} has wishlisted game ${gameId}`);
    const conn = await getPool().getConnection();
    const query = `SELECT * FROM wishlist WHERE user_id = ? AND game_id = ?`;
    const [rows] = await conn.query(query, [userId, gameId]);
    await conn.release();
    return rows.length > 0;
}

const removeGameFromWishlist = async (userId: number, gameId: number): Promise<void> => {
    Logger.info(`Removing game ${gameId} from user ${userId}'s wishlist`);
    const conn = await getPool().getConnection();
    const query = `DELETE FROM wishlist WHERE user_id = ? AND game_id = ?`;
    await conn.query(query, [userId, gameId]);
    await conn.release();
}

const addGameToOwned = async (userId: number, gameId: number): Promise<void> => {
    Logger.info(`Marking game ${gameId} as owned by user ${userId}`);
    const conn = await getPool().getConnection();
    const query = `INSERT INTO owned (user_id, game_id) VALUES (?, ?)`;
    await conn.query(query, [userId, gameId]);
    await conn.release();
}

const removeGameFromOwned = async (userId: number, gameId: number): Promise<void> => {
    Logger.info(`Unmarking game ${gameId} as owned by user ${userId}`);
    const conn = await getPool().getConnection();
    const query = `DELETE FROM owned WHERE user_id = ? AND game_id = ?`;
    await conn.query(query, [userId, gameId]);
    await conn.release();
}


export { gameExists, isGameOwned, wishlistGame, isGameWishlisted, removeGameFromWishlist,
        addGameToOwned, removeGameFromOwned};
