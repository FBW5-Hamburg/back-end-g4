const nodemailer = require('nodemailer')

const sensitiveData = require('./sensitiveData')

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'alen@gmail.com',
        password: sensitiveData.password()
    }
})

function sendEmail(name, email, subject, message, callback) {
    const mailOption = {
        from: 'alen@gmail.com',
        to: 'alen@gmail.com',
        subject: subject,
        text: email + '\n' + name + '\n' + message
    }

    transporter.sendMail(mailOption, function (error, info) {
        if (error) {
            console.log(error)
            callback(false)
        } else {
            console.log(info.response)
            callback(true)
        }
    })
}

module.exports = {
    sendEmail
}