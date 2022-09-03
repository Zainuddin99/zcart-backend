const { createCustomErrorInstance } = require("../Error handlers/customErrorHandler")
const Users = require('../Database/Models/all-users')
const { asyncWrapper } = require("../Error handlers/asyncWrapper")
require('dotenv').config()

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { sendMail } = require("../nodemailer")
const { createToken } = require('../functions/users')

const addUsers = asyncWrapper(async (req, res, next) => {

    const { firstName, lastName, eMail, password, confirmPassword } = req.body

    if (!firstName || !lastName || !eMail || !password || !confirmPassword) {
        return next(createCustomErrorInstance('All fields are required!', 400))
    }

    if (password !== confirmPassword) {
        return next(createCustomErrorInstance('Password don\'t match', 422))
    }

    const isExistingUser = await Users.findOne({ eMail })

    if (isExistingUser) {
        return next(createCustomErrorInstance('User with this email already exists', 400))
    }

    bcrypt.hash(password, 12, async (err, result) => {
        if (err) {
            return next()
        }
        const user = await Users.create({ firstName, lastName, eMail, password: result })

        sendMail(`${firstName} ${lastName}`, eMail)
            .then((result) => {
                if (result) {

                    res.status(201).json({ message: 'User created and mail sent to you' })

                } else {
                    res.status(201).json({ message: 'User created but we could not send mail to you!' })
                }
            })
    })

})


const signInUsers = asyncWrapper(async (req, res, next) => {
    const { eMail, password, googleSign } = req.body

    if (googleSign) {
        const { email: eMail, givenName: firstName, familyName: lastName } = googleSign
        const alreadyAdded = await Users.findOne({ eMail })
        if (!alreadyAdded) {
            await Users.create({ eMail, firstName, lastName })
        }
    }

    const user = await Users.findOne({ eMail: eMail || googleSign.email })

    if (user) {
        const userData = {
            eMail: user.eMail,
            fullName: user.firstName + ' ' + user.lastName,
            id: user._id
        }
        if (!googleSign) {
            try {
                const result = await bcrypt.compare(password, user.password)
                if (!result) {
                    return next(createCustomErrorInstance('Invalid password', 401))
                }
            } catch (error) {
                return next(createCustomErrorInstance('Try with google sign in for this email', 400))
            }
        }
        const token = createToken(userData, 'access')
        const refreshToken = createToken(userData, 'refresh')
        await Users.updateOne({
            eMail: user.eMail
        }, {
            $push:
            {
                sessions: {
                    ip: req.ip,
                    refreshToken
                }
            }
        })
        return res.status(201).json({ message: "Logged in successfully", userToken: token, refreshToken })
    }
    else {
        next(createCustomErrorInstance('No user found', 404))
    }
})

const verifyLoggedUser = (req, res, next) => {
    const { token } = req.body
    try {
        const decode = jwt.verify(token, process.env.SECRET_KEY)
        res.status(200).json(decode)
    } catch (err) {
        next(createCustomErrorInstance('Session expired', 403))
    }
}

const refreshTokens = async (req, res, next) => {
    try {
        const refreshToken = await verifyAccessToken(req)
        const newAccessToken = createToken(req.userId, 'access')
        res.json({ userToken: newAccessToken, refreshToken })
    } catch (error) {
        next(createCustomErrorInstance('session expired', 403))
    }
}

const verifyAccessToken = (req) => {
    return new Promise(async (resolve, reject) => {
        try {
            let refreshToken = req.headers.refreshtoken
            const { id } = req.userId
            const sessionExists = await Users.findOne({ _id: id, 'sessions.refreshToken': refreshToken }).select({ sessions: { $elemMatch: { refreshToken } } })
            if (!sessionExists) {
                console.log('Refresh token doesnt exist in user DB')
                return reject("Anauthorised!")
            }
            try {
                jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY)
            } catch (error) {
                console.log('Old refresh token expired...Creating new one')
                const newRefreshToken = createToken(req.userId, 'refresh')
                await Users.updateOne({ _id: id, 'sessions.refreshToken': refreshToken }, {
                    $set: {
                        "sessions.$.refreshToken": newRefreshToken
                    }
                })
                refreshToken = newRefreshToken
                console.log('New refresh token created and stored in DB')
            }
            resolve(refreshToken)
        } catch (error) {
            reject(error)
        }
    })
}

const logoutUser = asyncWrapper(async (req, res, next) => {
    await Users.updateOne({
        _id: req.userId.id
    }, {
        $pull: {
            sessions: { refreshToken: req.headers.refreshtoken }
        }
    })
    res.json({})
})

module.exports = { addUsers, signInUsers, verifyLoggedUser, refreshTokens, verifyAccessToken, logoutUser }
