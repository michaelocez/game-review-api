import { getPool } from "../../config/db";
import Logger from "../../config/logger";


const getImageFilename = async (userId: number): Promise<string | null> => {
    Logger.info(`Fetching image filename for user ${userId}`);
    const conn = await getPool().getConnection();
    const query = `SELECT image_filename FROM user WHERE id = ?`;
    const [rows] = await conn.query(query, [userId]);
    await conn.release();

    if (rows.length === 0 || !rows[0].image_filename) {
        return null;
    }

    return rows[0].image_filename;
}

const setImageFilename = async (userId: number, imageFilename: string): Promise<void> => {
    Logger.info(`Setting image filename for user ${userId} to ${imageFilename}`);
    const conn = await getPool().getConnection();
    const query = `UPDATE user SET image_filename = ? WHERE id = ?`;
    await conn.query(query, [imageFilename, userId]);
    await conn.release();
}

const deleteImageFilename = async (userId: number): Promise<void> => {
    Logger.info(`Removing image filename for user ${userId}`);
    const conn = await getPool().getConnection();
    const query = `UPDATE user SET image_filename = NULL WHERE id = ?`;
    await conn.query(query, [userId]);
    await conn.release();
}

export { getImageFilename, setImageFilename, deleteImageFilename };