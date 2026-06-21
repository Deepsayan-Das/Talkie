import nodemailer from 'nodemailer'

let transporter: nodemailer.Transporter
let testAccount: any
export const initializeTransporter = async () => {
    testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        }
    })
}

export const getTransporter = () => {
    if (!transporter) {
        throw new Error('Mail transporter not initialized');
    }
    return transporter;
}

export const getTestAccount = () => {
    return testAccount;
}