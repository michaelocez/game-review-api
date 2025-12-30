import { getPool } from "../../config/db";
import Logger from "../../config/logger";
import fs from "mz/fs";
import path from "path";

const IMAGE_STORAGE_PATH = path.join("storage", "images");


const getGameImageFilename = async (gameId: number): Promise<string | null> => {
    Logger.info(`Get image filename for game ${gameId}`);
    const conn = await getPool().getConnection();
    const query = `SELECT image_filename FROM game WHERE id = ?`;
    const [rows] = await conn.query(query, [gameId]);
    await conn.release();

    if (rows.length === 0 || !rows[0].image_filename) {
        return null;
    }
    return rows[0].image_filename;
}

const gameExists = async (gameId: number): Promise<boolean> => {
    Logger.info(`Checking if game with ID ${gameId} exists`);
    const conn = await getPool().getConnection();
    const query = `SELECT COUNT(*) AS count FROM game WHERE id = ?`;
    const [[{ count }]] = await conn.query(query, [gameId]);
    await conn.release();
    return count > 0;
}

const setGameImageFilename = async (gameId: number, imageFilename: string): Promise<void> => {
    Logger.info(`Setting image filename for game ID: ${gameId} to ${imageFilename}`);
    const conn = await getPool().getConnection();
    const query = `UPDATE game SET image_filename = ? WHERE id = ?`;
    await conn.query(query, [imageFilename, gameId]);
    await conn.release();
}

const saveGameImage = async (gameId: number, imageBuffer: Buffer, extension: string): Promise<string> => {
    Logger.info(`Save game image to storage and return filename.`);

    // Get game title
    const conn = await getPool().getConnection();
    const query = `SELECT title FROM game WHERE id = ?`;
    const [rows] = await conn.query(query, [gameId]);
    await conn.release();

    // Format the title. Replacing non-alphanumeric with underscores and making text lowercase
    const gameTitle = rows[0].title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const filename = `${gameTitle}.${extension}`
    const filePath = path.join(IMAGE_STORAGE_PATH, filename); // Make full file path

    await fs.writeFile(filePath, imageBuffer); // Save image to path
    return filename; // Return filename
}

const getGameImageFilePath = async (filename: string): Promise<string | null> => {
    // Make file path
    const filePath = path.resolve(IMAGE_STORAGE_PATH, filename); // Ensure absolute path
    // Check if the file exists in the storage directory
    if (await fs.exists(filePath)) {
        return filePath;
    }
    return null; // Return null if the file does not exist
}

const deleteOldImage = async (filename: string): Promise<void> => {
    // Construct the full file path for the image
    const filePath = path.join(IMAGE_STORAGE_PATH, filename);

    // Check if the image exists in storage
    if (await fs.exists(filePath)) {
        // If the image exists, delete it
        await fs.unlink(filePath);
    }
}



export { getGameImageFilename, gameExists, setGameImageFilename, saveGameImage, getGameImageFilePath, deleteOldImage };
