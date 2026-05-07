import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../__lib/db'
import { sendError } from '../__lib/helpers'
import * as nodemailer from 'nodemailer'
import * as ExcelJS from 'exceljs'
import * as path from 'path'

export default async function handler(req: VercelRequest, res: VercelResponse) {

  if (req.method === 'POST') {
    try {
      const { workdayId, employeeName, date } = req.body

      const workbook = new ExcelJS.Workbook()
      const templatePath = path.join(process.cwd(), 'templates', 'chek_list.xlsx')
      await workbook.xlsx.readFile(templatePath)
      const worksheet = workbook.worksheets[0]

      worksheet.getCell('G1').value = date
      worksheet.getCell('G2').value = employeeName

      const buffer = await workbook.xlsx.writeBuffer()

      const transporter = nodemailer.createTransport({
        host: 'smtp.yandex.ru',
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })

      await transporter.sendMail({
        from: `"JetMetrix System" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_TO,
        subject: `Чек-лист ЦПУ - Смена ${date}`,
        text: `Автоматический отчет. Чек-лист ЦПУ за ${date}. Сотрудник: ${employeeName}`,
        attachments: [{ filename: `Checklist_${date}.xlsx`, content: buffer as Buffer }],
      })

      await supabase.from('Workdays').update({ Checklist_Sent: 1 }).eq('id', workdayId)

      return res.json({ success: true, message: 'Чек-лист успешно отправлен' })
    } catch (error) {
      console.error('Checklist send error:', error)
      return sendError(res, 500, 'Не удалось отправить чек-лист')
    }
  }

  return sendError(res, 405, 'Method not allowed')
}
