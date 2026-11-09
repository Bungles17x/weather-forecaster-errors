// Vercel Serverless Function for Error Reporting
// This function receives error reports from the frontend and sends email notifications

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const errorReport = req.body

    if (!errorReport || !errorReport.timestamp || !errorReport.message) {
      return res.status(400).json({ error: 'Invalid error report format' })
    }

    const signature = errorReport.signature || generateSignature(errorReport)
    await storeError(errorReport, signature)
    await sendErrorEmail(errorReport)

    return res.status(200).json({ 
      success: true, 
      message: 'Error report received and email sent'
    })

  } catch (error) {
    console.error('Error in report-error function:', error)
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    })
  }
}

function generateSignature(report) {
  const message = report.message || ''
  const stack = report.stack?.split('\n')[0] || ''
  return `${message}-${stack}`.slice(0, 100)
}

async function storeError(report, signature) {
  console.log('[Error Stored]', { signature, message: report.message, timestamp: report.timestamp })
}

async function sendErrorEmail(report) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const ERROR_EMAIL = process.env.ERROR_EMAIL || 'your-email@example.com'
  
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured, skipping email')
    return
  }

  const emailBody = `
Weather Forecaster Error Report
==============================

Timestamp: ${report.timestamp}
Error Code: ${report.id || 'N/A'}
Severity: ${report.severity?.toUpperCase() || 'UNKNOWN'}
Category: ${report.category?.toUpperCase() || 'UNKNOWN'}

Error Message:
${report.message}

Stack Trace:
${report.stack || 'No stack trace available'}

Context:
- URL: ${report.context?.url || 'N/A'}
- Online: ${report.context?.online ? 'Yes' : 'No'}
- User Agent: ${report.context?.userAgent || 'N/A'}

Occurrences: ${report.count || 1}
Last Seen: ${report.lastSeen || report.timestamp}
  `.trim()

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Weather Forecaster <errors@weather-forecaster.app>',
        to: ERROR_EMAIL,
        subject: `[${report.severity?.toUpperCase() || 'ERROR'}] Weather Forecaster Error - ${report.message?.slice(0, 50)}...`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
            <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #ff003c; margin-top: 0;">Weather Forecaster Error Report</h2>
              <p style="color: #666;">Severity: <strong>${report.severity?.toUpperCase() || 'UNKNOWN'}</strong></p>
              <p style="color: #666;">Category: <strong>${report.category?.toUpperCase() || 'UNKNOWN'}</strong></p>
              <p style="color: #666;">Timestamp: ${new Date(report.timestamp).toLocaleString()}</p>
              
              <h3 style="color: #333; margin-top: 30px;">Error Message</h3>
              <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px; color: #333;">${report.message}</pre>
              
              <h3 style="color: #333; margin-top: 20px;">Stack Trace</h3>
              <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 11px; color: #666;">${report.stack || 'No stack trace available'}</pre>
              
              <h3 style="color: #333; margin-top: 20px;">Context</h3>
              <ul style="color: #666; line-height: 1.8;">
                <li>URL: ${report.context?.url || 'N/A'}</li>
                <li>Online: ${report.context?.online ? 'Yes' : 'No'}</li>
                <li>Occurrences: ${report.count || 1}</li>
              </ul>
              
              <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                This is an automated error report from Weather Forecaster. Do not reply to this email.
              </p>
            </div>
          </div>
        `
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Resend API error: ${response.status} ${errorText}`)
    }

    const result = await response.json()
    console.log('Email sent successfully:', result)

  } catch (error) {
    console.error('Failed to send error email:', error)
  }
}
