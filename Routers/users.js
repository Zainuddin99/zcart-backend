const { addUsers, signInUsers, verifyLoggedUser, refreshTokens, logoutUser } = require('../Controllers/users')
const { tokenVerifier } = require('../Middlewares/auth')
const router = require('./carts')

const routers = require('express').Router()

routers.post('/signup', addUsers)
routers.post('/signin', signInUsers)
routers.post('/verify', verifyLoggedUser)
routers.post('/refreshTokens', tokenVerifier, refreshTokens)
routers.post('/logout', tokenVerifier, logoutUser)

module.exports = routers