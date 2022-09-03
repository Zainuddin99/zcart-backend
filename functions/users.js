const jwt = require("jsonwebtoken")
const { ACCESS_EXPIRATION, REFRESH_EXPIRATION } = require("../constants/users")

module.exports.createToken = (data, type) => {
    if (!(type === "access" || type === 'refresh')) {
        throw new Error("Invalid type!")
    }
    return jwt.sign(
        data,
        process.env[type === "access" ? 'SECRET_KEY' : 'REFRESH_SECRET_KEY'],
        { expiresIn: type === "access" ? ACCESS_EXPIRATION : REFRESH_EXPIRATION }
    )
}