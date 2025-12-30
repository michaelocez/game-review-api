import bcrypt from "bcrypt";

const hash = async (password: string): Promise<string> => {
    // todo: password hashing and comparing are left to you
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
}

const compare = async (password: string, comp: string): Promise<boolean> => {
    // todo: password hashing and comparing are left to you
    const matchedPassword = await bcrypt.compare(password, comp);
    return matchedPassword;
}

export {hash, compare}