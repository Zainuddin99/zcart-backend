const jwt = require("jsonwebtoken")
require('dotenv').config()
const Users = require("../Database/Models/all-users")
const { createCustomErrorInstance } = require("../Error handlers/customErrorHandler")

module.exports.tokenVerifier = async (req, res, next) => {
    const token = req.headers.authorization
    try {
        const user = jwt.verify(token.split(' ')[1], process.env.SECRET_KEY)
        const refreshToken = req.headers.refreshtoken
        const userSessionExist = await Users.findOne({ _id: user.id, "sessions.refreshToken": refreshToken })
        if (!userSessionExist) {
            console.log("User session dont exist!")
            return next(createCustomErrorInstance('Anauthorised!', 401))
        }
        delete user.exp
        delete user.iat
        req.userId = user
        next()
    } catch (error) {
        console.log(error);
        res.status(401).json({ message: 'Authorization failed' })
    }
}