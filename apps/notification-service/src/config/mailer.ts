import nodemailer from 'nodemailer'
import logger from './logger'

let transporter: nodemailer.Transporter
let isEthereal = false

export const initializeTransporter = async () => {
    const smtpHost = process.env.SMTP_HOST
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS

    if (smtpHost && smtpUser && smtpPass) {
        // ── Real SMTP (Gmail, SendGrid, Resend, etc.) ──────────────────────
        transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',  // true = 465, false = STARTTLS
            auth: {
                user: smtpUser,
                pass: smtpPass,
            },
        })
        isEthereal = false
        logger.info('Mail transporter initialized with real SMTP', { host: smtpHost })
    } else {
        // ── Ethereal fallback for development ──────────────────────────────
        const testAccount = await nodemailer.createTestAccount()
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        })
        isEthereal = true
        logger.warn('SMTP_HOST/SMTP_USER/SMTP_PASS not set — using Ethereal test account', {
            user: testAccount.user,
        })
    }
}

export const getTransporter = () => {
    if (!transporter) {
        throw new Error('Mail transporter not initialized — call initializeTransporter() first')
    }
    return transporter
}

/** Returns true when using the Ethereal test account (dev-only) */
export const isDevMailer = () => isEthereal