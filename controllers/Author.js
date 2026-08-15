const { fileDownloader } = require("../middleware/Helper")
const Image = require("../models/Image")
const Message = require("../models/Message")
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const Author = require('../models/Author')
const path = require("path")
const fs = require('fs')
const Track = require("../models/Track")
const { isValidObjectId } = require("mongoose")
const crypto = require("crypto")
const nodemailer = require("nodemailer")
const { default: axios } = require("axios")

const BASE_DIR = path.join(process.cwd(), "uploads", "twemoji")

const verificationTemplate = (otp) => {
    return `
        <div style="
            margin: 0;
            padding: 40px 20px;
            background: linear-gradient(
                135deg,
                #fff7f5 0%,
                #ffe9e4 100%
            );
            font-family: Arial, sans-serif;
        ">

            <div style="
                max-width: 560px;
                margin: auto;
                background: white;
                border-radius: 28px;
                overflow: hidden;
                box-shadow:
                    0 10px 40px rgba(224, 125, 108, 0.15);
            ">

                <!-- Top Gradient -->
                <div style="
                    height: 8px;
                    background: linear-gradient(
                        90deg,
                        #ff9a8b,
                        #ff6a88,
                        #ff9a8b
                    );
                "></div>

                <div style="padding: 42px;">

                    <!-- Branding -->
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        margin-bottom: 34px;
                    ">

                        <img
                            src="https://res.cloudinary.com/dkcyztevs/image/upload/f_auto,q_auto/Logo_tcmc8s"
                            alt="Track Pixels"
                            style="
                                width: 68px;
                                height: 68px;
                                border-radius: 18px;
                                object-fit: cover;
                                box-shadow:
                                    0 4px 14px rgba(0,0,0,0.08);
                            "
                        />

                        <div>
                            <div style="
                                font-size: 28px;
                                font-weight: 700;
                                color: #e07d6c;
                                line-height: 1;
                            ">
                                Track Pixels
                            </div>

                            <div style="
                                font-size: 13px;
                                color: #999;
                                margin-top: 6px;
                            ">
                                Send Magic • Track Everything
                            </div>
                        </div>
                    </div>

                    <!-- Heading -->
                    <h2 style="
                        margin: 0 0 16px;
                        font-size: 32px;
                        color: #222;
                    ">
                        Verify Your Email
                    </h2>

                    <p style="
                        font-size: 16px;
                        line-height: 1.7;
                        color: #666;
                        margin-bottom: 32px;
                    ">
                        Use the verification code below
                        to complete your sign up.
                    </p>

                    <!-- OTP Box -->
                    <div style="
                        background:
                            linear-gradient(
                                135deg,
                                #fff5f2,
                                #fff
                            );
                        border: 1px solid #ffd4cb;
                        border-radius: 22px;
                        padding: 28px;
                        text-align: center;
                        margin-bottom: 32px;
                    ">

                        <div style="
                            font-size: 13px;
                            color: #999;
                            margin-bottom: 12px;
                            letter-spacing: 1px;
                            text-transform: uppercase;
                        ">
                            Verification Code
                        </div>

                        <div style="
                            font-size: 42px;
                            font-weight: 700;
                            letter-spacing: 12px;
                            color: #e07d6c;
                        ">
                            ${otp}
                        </div>
                    </div>

                    <!-- Expiry -->
                    <div style="
                        font-size: 15px;
                        color: #666;
                        margin-bottom: 28px;
                    ">
                        This OTP will expire in
                        <strong>15 minutes</strong>.
                    </div>

                    <!-- Footer -->
                    <div style="
                        border-top: 1px solid #f2f2f2;
                        padding-top: 22px;
                        font-size: 13px;
                        line-height: 1.7;
                        color: #999;
                    ">
                        If you did not request this
                        verification, you can safely
                        ignore this email.
                    </div>

                </div>
            </div>
        </div>
    `
}

const uploadImage = async (req, res) => {
    const { image } = req.body

    if (!image) {
        return res.json({
            success: false,
            message: "Please send an encoded image"
        })
    }

    const file = await fileDownloader("spoon", image)

    if (file === false) {
        return res.json({
            success: false,
            message: "Invalid encoded image"
        })
    }

    const created = await Image.create({ blob: image })

    const id = created._id

    const message = await Message.findOne({ active: true })

    // No active message box, create one
    if (message === null) {
        await Message.create({ image: [id], active: true })

        return res.json({
            success: true,
            message: "Upload success",
            file
        })
    }

    const count = message.image.length

    // Just update the message box with image
    if (count < 7) {
        await Message.findOneAndUpdate({ active: true }, {
            $push: { image: id }
        })

        return res.json({
            success: true,
            message: "Upload success",
            file
        })
    }

    // Message full with seven images, create a new active message
    await Message.findOneAndUpdate({ active: true }, {
        active: false
    })

    await Message.create({ image: [id], active: true })

    res.json({
        success: true,
        message: "Upload success",
        file
    })
}

const togglePaste = async (req, res) => {
    const { tid, paste } = req.body

    const author = req.user

    if (isValidObjectId(tid) === false) {
        return res.json({
            success: false,
            message: "Invalid track id"
        })
    }

    const valid = await Message.findOne({ author: author._id, tid })

    if (valid === null) {
        return res.json({
            success: false,
            message: "Invalid track id"
        })
    }

    await Track.findOneAndUpdate({ _id: tid }, { paste })

    res.json({
        success: true,
        message: "Toggle paste success"
    })
}

const enableTracking = async (req, res) => {
    const { tid, text } = req.body

    const author = req.user

    if (typeof text !== 'string' || text.trim() === '') {
        return res.json({
            success: false,
            message: "Text sent is required"
        })
    }

    if (isValidObjectId(tid) === false) {
        return res.json({
            success: false,
            message: "Invalid track id"
        })
    }

    const valid = await Message.findOneAndUpdate({ author: author._id, tid }, { text })

    if (valid === null) {
        return res.json({
            success: false,
            message: "Not a valid track id"
        })
    }

    const updated = await Track.findOneAndUpdate({ _id: tid, paste: true }, {
        fire: true,
        firefox: new Date()
    })

    if (updated === null) {
        return res.json({
            success: false,
            message: "You didn't paste into an e-mail client"
        })
    }

    res.json({
        success: true,
        message: "Tracking has been enabled"
    })
}

const messageStatus = async (req, res) => {
    const { tid } = req.body

    const author = req.user

    if (isValidObjectId(String(tid)) === false) {
        return res.json({
            success: false,
            message: "Invalid track id"
        })
    }

    const message = await Message.findOne({ author: author._id, tid })

    if (message === null) {
        return res.json({
            success: false,
            message: "Not a valid track id"
        })
    }

    const track = await Track.findOne({ _id: tid })

    if (track.fire === false) {
        return res.json({
            success: false,
            message: "Tracking not started"
        })
    }

    res.json({
        success: true,
        message: "Trackig status",
        track,
        message
    })
}

const socketPaste = async (req, res) => {
    const { tid } = req.body

    const author = req.user

    if (isValidObjectId(tid) === false) {
        return res.json({
            success: false,
            message: "Invalid track id"
        })
    }

    // Check if author sent his track id i.e. not tampered
    const valid = await Message.findOne({ author: author._id, tid })

    if (valid === null) {
        return res.json({
            success: false,
            message: "Invalid track id"
        })
    }

    const track = await Track.findOne({ _id: tid })

    res.json({
        success: true,
        message: "Tracking status",
        paste: track.paste
    })
}

const fetchImage = async (req, res) => {
    const { id } = req.params
    const { tid } = req.query

    const ua = req.get('User-Agent')

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip

    // Strips path parts
    const filename = path.basename(id)

    // Invalid path not a png
    if (!/^[a-zA-Z0-9._-]+\.png$/.test(filename)) {
        return res.json({
            success: false,
            message: "Invalid mime type"
        })
    }

    const image = path.resolve(BASE_DIR, filename)

    if (!fs.existsSync(image)) {
        return res.json({
            success: false,
            message: "Emoji doesn't exist"
        })
    }

    if (tid === undefined) {
        return res.sendFile(image)
    }

    const track = await Track.findOne({ _id: tid })

    if (track === null) {
        return res.json({
            success: false,
            message: "Tracker not found"
        })
    }

    // Check if user pasted into client
    if (track.paste === false && track.fire === false) {
        await Track.findOneAndUpdate({ _id: tid, paste: false }, {
            paste: true
        })

        return res.sendFile(image)
    }

    // Save the timestamp to message
    const update = {
        $push: {
            unix: {
                $each: [
                    {
                        ip,
                        ua,
                        timestamp: new Date(),
                    },
                ],
                $position: 0, // insert at beginning (newest first)
            },
        },
        $set: {
            seen: true,
        }
    }

    await Track.findOneAndUpdate({ _id: tid, fire: true }, update)

    res.sendFile(image)
}

const activeMessage = async (req, res) => {
    const message = await Message.findOne({ active: true })

    if (message && message.unix) {
        message.unix = message.unix.reverse()
    }

    res.json({
        success: true,
        message
    })
}

const keepAlive = async (req, res) => {
    const ua = req.get('User-Agent')

    // Get the IP Address
    // We check 'x-forwarded-for' first because if you are on a cloud host, 
    // req.ip often returns the internal load balancer IP, not the real user.
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip

    console.log(`+ Ping received from: ${ip}\n+ Client device: ${ua}`)

    // Keep mongodb in sync so it doesn't get inactive
    const image = await Image.findOne({})

    res.json({
        success: true,
        message: "Web Service and database active"
    })
}

const loginUser = async (req, res) => {
    const { username, password } = req.body

    const identifier =
        typeof username === "string"
            ? username.trim().toLowerCase()
            : ""

    if (!identifier) {
        return res.json({
            success: false,
            message: "Username or email is required"
        })
    }

    if (typeof password !== "string" || password.trim() === "") {
        return res.json({
            success: false,
            message: "Password is required"
        })
    }

    // Check if input is an email
    const isEmail = identifier.includes("@")

    const user = await Author.findOne(
        isEmail
            ? { address: identifier }   // login with email
            : { username: identifier }  // login with username
    )

    if (!user) {
        return res.json({
            success: false,
            message:
                "The username or email you entered doesn't belong to an account. Please check and try again."
        })
    }

    const match = await bcrypt.compare(password, user.password)

    if (!match) {
        return res.json({
            success: false,
            message:
                "Sorry, your password was incorrect. Please double-check your password."
        })
    }

    const token = jwt.sign(
        {
            _id: user._id,
            username: user.username
        },
        process.env.JWT_ACCESS_TOKEN
    )

    res.json({
        success: true,
        message: "Logged in successfully",
        token
    })
}

const registerUser = async (req, res) => {
    const { fname, username, email, password } = req.body

    const _email = typeof email === "string"
        ? email.trim().toLowerCase()
        : ""

    if (!_email) {
        return res.json({
            success: false,
            message: "E-mail address is required"
        })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailRegex.test(_email)) {
        return res.json({
            success: false,
            message: "Invalid e-mail address"
        })
    }

    const _username = typeof username === "string"
        ? username.trim().toLowerCase()
        : ""

    if (!_username) {
        return res.json({
            success: false,
            message: "Username is required"
        })
    }

    // Validate username format
    if (_username.length < 4 || _username.length > 20) {
        return res.json({
            success: false,
            message: "Username must be 4-20 characters long"
        })
    }

    if (_username.startsWith("-") || _username.endsWith("-")) {
        return res.json({
            success: false,
            message: "Username can't start or end with hyphen"
        })
    }

    const usernameRegex = /^[a-zA-Z0-9-]+$/

    if (!usernameRegex.test(_username)) {
        return res.json({
            success: false,
            message: "Username can contain alphabets, numbers and hyphen"
        })
    }

    if (/--/.test(_username)) {
        return res.json({
            success: false,
            message: "Username cannot contain consecutive hyphens"
        })
    }

    if (typeof password !== "string" || password.trim() === "") {
        return res.json({
            success: false,
            message: "Password is required"
        })
    }

    // Validate password
    // Password must include capital, small alphabets, numbers and a symbol
    //  Password should have atleast eight characters
    if (password.length < 8) {
        return res.json({
            success: false,
            message: "Password should have atleast eight characters"
        })
    }

    const small = password.match(/[a-z]+/g)
    const capital = password.match(/[A-Z]+/g)
    const number = password.match(/[0-9]+/g)
    const symbol = password.match(/[-+~`@#$%^&*()_={}\[\]\/:;"'<>,?\.]+/g)

    if (small === null || capital === null || symbol === null || number === null) {
        return res.json({
            success: false,
            message: "Password must include capital, small alphabets, numbers and a symbol"
        })
    }

    const hashed = await bcrypt.hash(password, 10)

    // Check for duplicate username or e-mail address
    const duplicate = await Author.findOne({
        $or: [
            { username: _username },
            { address: _email }
        ]
    })

    if (duplicate && duplicate.verified) {
        if (duplicate.username === _username) {
            return res.json({
                success: false,
                message: "This username isn't available. Please try another."
            })
        }

        return res.json({
            success: false,
            message: "An account with this email already exists."
        })
    }

    // Unverified e-mail address
    if (duplicate && duplicate.verification && duplicate.verification.resends > 5) {
        return res.json({
            success: false,
            message: "Too many sign up attempts"
        })
    }

    // Generate OTP
    const otp = Math.floor(
        100000 + Math.random() * 900000
    ).toString()

    const hashedOtp = crypto
        .createHash("sha256")
        .update(otp)
        .digest("hex")

    // const transporter = nodemailer.createTransport({
    //     host: process.env.BREVO_HOST,
    //     port: process.env.BREVO_PORT,
    //     secure: false,
    //     auth: {
    //         user: process.env.BREVO_USER,
    //         pass: process.env.BREVO_PASS
    //     }
    // })

    try {
        // await transporter.sendMail({
        //     from: '"Track Pixels" <support@trackpixels.online>',
        //     to: _email,
        //     subject: "Verify your email address",
        //     text: `Your verification code is ${otp}`,
        //     html: verificationTemplate(otp)
        // })
        await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
                sender: {
                    name: "Track Pixels",
                    email: "support@trackpixels.online"
                },
                to: [
                    {
                        email: _email
                    }
                ],
                subject: "Verify your email address",
                textContent: `Your verification code is ${otp}`,
                htmlContent: verificationTemplate(otp)
            },
            {
                headers: {
                    "api-key": process.env.BREVO_API_KEY,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            }
        )
    } catch (err) {
        console.log("[-] Failed to send e-mail", _email, err)

        const errors = ["EENVELOPE", "EMESSAGE", "ECONNECTION"]

        if (errors.includes(err.code)) {
            return res.json({
                success: false,
                message:
                    "Unable to deliver email to this address."
            })
        }

        // Brevo/Gmail recipient rejection
        if (err.responseCode === 550 || err.responseCode === 553) {
            return res.json({
                success: false,
                message: "This email address is invalid or unavailable."
            })
        }

        return res.json({
            success: false,
            message: "Failed to send verification email."
        })
    }

    // Save new user to database
    // 15 minutes
    await Author.findOneAndUpdate({ address: _email }, {
        $set: {
            fname,
            username: _username,
            address: _email,
            password: hashed,

            "verification.otp": hashedOtp,
            "verification.attempts": 0,
            "verification.timestamp": new Date(),
            "verification.expires":
                Date.now() + 1000 * 60 * 15
        },
        $inc: {
            "verification.resends": 1
        }
    },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    )

    res.json({
        success: true,
        message: "User registered successfully"
    })
}

const verifyEmail = async (req, res) => {
    const { email, otp } = req.body

    const _email =
        typeof email === "string"
            ? email.trim().toLowerCase()
            : ""

    const _otp =
        typeof otp === "string"
            ? otp.trim()
            : ""

    if (!_email || !_otp) {
        return res.json({
            success: false,
            message:
                "Please enter 6 digit otp sent to e-mail"
        })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailRegex.test(_email)) {
        return res.json({
            success: false,
            message: "Invalid e-mail address"
        })
    }

    if (!/^\d{6}$/.test(_otp)) {
        return res.json({
            success: false,
            message: "Please enter 6 digit otp sent to e-mail"
        })
    }

    const user = await Author.findOne({ address: _email })

    if (!user) {
        return res.json({
            success: false,
            message: "Invalid verification request"
        })
    }

    if (user.verified) {
        return res.json({
            success: false,
            message: "Account already verified"
        })
    }

    if (!user.verification || !user.verification.otp) {
        return res.json({
            success: false,
            message: "No verification request found"
        })
    }

    // OTP expired
    if (user.verification.expires < Date.now()) {
        return res.json({
            success: false,
            message: "OTP has expired"
        })
    }

    // Too many attempts
    if (user.verification.attempts >= 10) {
        return res.json({
            success: false,
            message: "Too many incorrect attempts"
        })
    }

    // Hash incoming OTP
    const hashedOtp = crypto
        .createHash("sha256")
        .update(_otp)
        .digest("hex")

    // Incorrect OTP
    if (hashedOtp !== user.verification.otp) {
        await Author.findOneAndUpdate({ address: _email }, {
            $inc: {
                "verification.attempts": 1
            }
        })

        return res.json({
            success: false,
            message: "Incorrect OTP"
        })
    }

    await Author.findOneAndUpdate({ address: _email }, {
        verified: true,
        $unset: {
            verification: 1
        }
    })

    res.json({
        success: true,
        message: "Email verified successfully"
    })
}

const checkUsername = async (req, res) => {
    const { username } = req.body;

    const _username =
        typeof username === "string"
            ? username.trim().toLowerCase()
            : ""

    if (!_username) {
        return res.json({
            success: false,
            message: "Username is required"
        })
    }

    // Length
    if (_username.length < 4 || _username.length > 20) {
        return res.json({
            success: false,
            message: "Username must be 4-20 characters long"
        })
    }

    // Allowed chars
    const usernameRegex = /^[a-z0-9-]+$/

    if (!usernameRegex.test(_username)) {
        return res.json({
            success: false,
            message:
                "Username can contain alphabets, numbers and hyphen"
        })
    }

    // No edge hyphens
    if (
        _username.startsWith("-") ||
        _username.endsWith("-")
    ) {
        return res.json({
            success: false,
            message:
                "Username can't start or end with hyphen"
        })
    }

    // No consecutive hyphens
    if (/--/.test(_username)) {
        return res.json({
            success: false,
            message:
                "Username cannot contain consecutive hyphens"
        })
    }

    const match = await Author.findOne({
        username: _username
    }).lean()

    if (match) {
        return res.json({
            success: false,
            message:
                "This username isn't available. Please try another."
        })
    }

    res.json({
        success: true,
        message: "Username available"
    })
}

const sendEmail = async (req, res) => {
    console.log("Send", process.env.BREVO_USER)

    res.json({
        status: "success",
        message: "It works"
    })
}

module.exports = {
    uploadImage,
    keepAlive,
    fetchImage,
    activeMessage,
    loginUser,
    registerUser,
    togglePaste,
    enableTracking,
    socketPaste,
    messageStatus,
    checkUsername,
    verifyEmail,
    sendEmail
}
