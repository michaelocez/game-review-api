import { getPool } from "../../config/db";
import Logger from "../../config/logger";

const getReviewsForGame = async (gameId: number): Promise<any[]> => {
    Logger.info(`Get reviews for game ID: ${gameId}`);
    const conn = await getPool().getConnection();

    const query = `SELECT u.id AS reviewerId, u.first_name AS reviewerFirstName, u.last_name AS
                    reviewerLastName, gr.rating, gr.review, gr.timestamp FROM game_review gr JOIN user u
                    ON gr.user_id = u.id WHERE gr.game_id = ? ORDER BY gr.timestamp DESC`;
    const [rows] = await conn.query(query, [gameId]);
    await conn.release();
    return rows;
}

const hasUserReviewedGame = async (gameId: number, userId: number): Promise<boolean> => {
    Logger.info(`Checking if user ${userId} has reviewed game ${gameId}`);
    const conn = await getPool().getConnection();
    const query = `SELECT id FROM game_review WHERE game_id = ? AND user_id = ?`;
    const [rows] = await conn.query(query, [gameId, userId]);
    await conn.release();
    return rows.length > 0;
}

const addReview = async (gameId: number, userId: number, rating: number, review?: string): Promise<void> => {
    Logger.info(`Adding review for game ${gameId} by user ${userId}`);
    const conn = await getPool().getConnection();
    const query = `INSERT INTO game_review (game_id, user_id, rating, review, timestamp) VALUES (?, ?, ?, ?, NOW())`;
    await conn.query(query, [gameId, userId, rating, review || null]);
    await conn.release();
}

export { getReviewsForGame, hasUserReviewedGame, addReview };
