import { getPool } from "../../config/db";
import Logger from "../../config/logger";
import { ResultSetHeader } from 'mysql2'

const insert = async (email: string, firstName:string, lastName:string, password:string): Promise<ResultSetHeader> => {
    Logger.info(`Adding user ${email} to the database`);
    const conn = await getPool().getConnection();
    const query = 'INSERT INTO user (email, first_name, last_name, password) VALUES (?, ?, ?, ?)';
    const [ result ] = await conn.query( query, [ email, firstName, lastName, password ] );
    await conn.release();
    return result;
}

const emailExists = async (email: string): Promise<boolean> => {
    Logger.info(`Checking if ${email} exists`);
    const conn = await getPool().getConnection();
    const query = 'SELECT id FROM user WHERE email = ?';
    const [ result ] = await conn.query( query, [ email ] );
    await conn.release();
    return result.length > 0;
}

const getUserById = async (id: number): Promise<{firstName: string, lastName: string, email?:string}> => {
    Logger.info(`Get user ID: ${id}`);
    const conn = await getPool().getConnection();
    const query = 'SELECT first_name, last_name, email FROM user WHERE id = ?';
    const [ rows ] = await conn.query( query, [ id ] );
    await conn.release();

    if (rows.length === 0) {
        return null;
    }

    return {
        firstName: rows[0].first_name,
        lastName: rows[0].last_name,
        email: rows[0].email
    };

}

const getUserByEmail = async (email: string): Promise<{id: number, password: string}> => {
    Logger.info(`Get user by email: ${email}`);
    const conn = await getPool().getConnection();
    const query = 'SELECT id, password FROM user WHERE email = ?';
    const [ rows ] = await conn.query( query, [ email ] );
    await conn.release();

    if (rows.length === 0) {
        return null;
    }
    return rows[0];
}

const storeAuthToken = async (userId: number, authToken: string): Promise<void> => {
    Logger.info(`Storing auth token for user ID: ${userId}`);
    const conn = await getPool().getConnection();
    const query = `UPDATE user SET auth_token = ? WHERE id = ?`;
    await conn.query( query, [ authToken, userId ] );
    await conn.release();
}

const removeAuthToken = async (authToken: string): Promise<void> => {
    Logger.info(`Logging out user with auth token: ${authToken}`);
    const conn = await getPool().getConnection();
    const query = 'UPDATE user SET auth_token = NULL WHERE auth_token = ?';
    await conn.query( query, [ authToken ] );
    await conn.release();
}

const getUserByAuthToken = async (authToken: string): Promise<any> => {
    Logger.info(`Get user by auth token: ${authToken}`);
    const conn = await getPool().getConnection();
    const query = 'SELECT id FROM user WHERE auth_token = ?';
    const [ rows ] = await conn.query( query, [ authToken ] );
    await conn.release();

    if (rows.length === 0) {
        return null;
    }
    return rows[0];
}

const updateUser = async (id: number, firstName?: string, lastName?: string, email?: string,
                                                    password?: string): Promise<void> => {
    Logger.info(`Updating user ${id} in the database`);
    const conn = await getPool().getConnection();

    if (firstName !== undefined) {
        await conn.query('UPDATE user SET first_name = ? WHERE id = ?', [firstName, id]);
    }
    if (lastName !== undefined) {
        await conn.query('UPDATE user SET last_name = ? WHERE id = ?', [lastName, id]);
    }
    if (email !== undefined) {
        await conn.query('UPDATE user SET email = ? WHERE id = ?', [email, id]);
    }
    if (password !== undefined) {
        await conn.query('UPDATE user SET password = ? WHERE id = ?', [password, id]);
    }

    await conn.release();
};



export { insert, emailExists, getUserById, getUserByEmail, storeAuthToken, removeAuthToken, getUserByAuthToken,
        updateUser }