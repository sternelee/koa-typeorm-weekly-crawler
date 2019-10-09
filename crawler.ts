import "reflect-metadata"
import { createConnection, getManager } from 'typeorm'
import * as puppeteer from 'puppeteer'
import * as cheerio from 'cheerio'
import { google } from 'translation.js'
import tinify from 'tinify'
import { JavaScriptWeekly } from './src/entity/JavaScriptWeekly'
import * as fs from 'fs'
import * as request from 'request'

const myConnection = createConnection()

tinify.key = 'dFNyGR77vsxskHxqgLhY0R6Zyx5Jspfs/6Hd_ugwx8'

interface IPost {
  pid?: string //内容ID
  page: string // 期号，当作页码
  date: string // 期号对应的日期
  title: string // 内容标题
  title_cn?: string // 中文的标题
  category?: number // 内容分类，对应：Post, Jobs, 📘 Articles & Tutorials, 🔧 Code & Tools, Quick bytes, ⚡️ Quick Releases
  link?: string // 内容外链
  img?: string // 可能的大头图
  pic?: string // 可能的内容小配图
  summary?: string // 简介
  summary_cn?: string // 中文简介
}

let category = 0 // 类型id
let theNext = 457
let Posts: IPost[] = []

const shotDir = 'static/javascript/'

// const URI = 'https://javascriptweekly.com/issues/latest';
const URI = 'https://javascriptweekly.com/issues/'

// 翻译简介内容
function translateAll () {
  const maxLen = Posts.length
  let idx = 0
  Posts.forEach((v, index) => {
    google.translate(v.summary).then(res => {
      idx += 1
      Posts[index].summary_cn = res.result.toString()
      if (idx >= maxLen) {
        saveData()
      }
    })
  })
}

// 保存数据到 sqlit3
async function saveData () {
  const ArticleRepository = getManager().getRepository(JavaScriptWeekly)
  Posts.forEach(v => {
    const article = new JavaScriptWeekly()
    article.pid = v.pid || ''
    article.page = v.page
    article.date = v.date
    article.category = v.category || 0
    article.title = v.title || ''
    article.title_cn = v.title_cn || ''
    article.link = v.link || ''
    article.img = v.img || ''
    article.pic = v.pic || ''
    article.summary = v.summary || ''
    article.summary_cn = v.summary_cn || ''
    ArticleRepository.save(article)
  })
  // setTimeout(() => {
  //   console.log(theNext, 'done')
  //   theNext += 1
  //   // crawJob()
  // }, 2000)
}

async function downloadImg () {
  request('https://res.cloudinary.com/cpress/image/upload/w_1280,e_sharpen:60/v1570202912/ovhkzqclpz5rp5wjyjfk.jpg').pipe(fs.createWriteStream('1.png'))
}

// 使用 puppeteer
const crawJob = async function () {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--enable-reader-mode=true'],
    dumpio: false
  })
  // Reader Mode triggering 显示简化版视图
  const page = await browser.newPage()
  await page.emulate(puppeteer.devices['Pixel 2 XL'])
  // 模拟iphone X设备
  // await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1')
  // await page.setViewport({
  //   width: 375,
  //   height: 812,
  //   deviceScaleFactor: 3,
  //   isMobile: true,
  //   hasTouch: true
  // })
  const shotPage = await browser.newPage()
  await shotPage.emulate(puppeteer.devices['Pixel 2 XL'])
  const tinifyShot = async (id: string) => {
    const source = tinify.fromFile(`${shotDir}${id}.png`)
    source.toFile(`${shotDir}${id}.png`)
    console.log('压缩成功')
  }
  const crawShotPage = async (id: string) => {
    try {
      await shotPage.goto(`https://javascriptweekly.com/link/${id}/web`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      })
      // await shotPage.screenshot({path: `${shotDir}${id}.jpeg`, fullPage: true, type: 'jpeg', quality: 60})
      await shotPage.screenshot({path: `${shotDir}${id}.png`, fullPage: true})
      console.log('保存shotpage成功')
      // tinifyShot(id)
    } catch(e) {
      console.log('无法请求页面')
    }
  }
  await page.goto(URI + theNext, {
    waitUntil: 'networkidle2',
    timeout: 30000
  })
  // await page.screenshot({path: `${theNext}.png`, fullPage: true})
  const content = await page.content()
  // const body = await page.$('body')
  // console.log(content)
  const $ = await cheerio.load(content)
  // console.log($('.mainlink'))
  const title = $('title').text()
  const date = title.split(': ')[1]
  const main = $('#content')
  const tables = main.children('table')
  category = 0
  Posts = []
  for (const table of Array.from(tables)) {
    const cs = table.attribs.class ? table.attribs.class.trim() : ''
    const $$ = cheerio.load(table)
    if (cs === 'el-heading') {
      category += 1
      Posts.push({
        page: String(theNext),
        date,
        title: $$('p').text()
      })
    }
    if (cs === 'el-fullwidthimage') {
      // 封面图
      const link = $$('a').attr('href')
      const img = $$('img').attr('src')
      const pid = link.replace(/[^0-9]/ig, '')
      console.log(link, img)
      request(img).pipe(fs.createWriteStream(`${shotDir}/pic/${pid}.png`))
      Posts.push({
        pid,
        page: String(theNext),
        date,
        title: '',
        img
      })
    }
    if (cs === 'el-subtable') {
      // Quick bytes OR Quick Releases
      const subTable = $$('.content.el-content')
      const subUl = $$('.nogap li')
      for (const li of Array.from(subUl)) {
        const $$$ = cheerio.load(li)
        if (subTable.attr('class') === 'content el-content briefs') {
          // Quick bytes
          const title = $$$('li').text()
          const link = $$$('a').attr('href')
          const title_cn = await google.translate(title)
          const pid = link.replace(/[^0-9]/ig, '')
          await crawShotPage(pid)
          const post = {
            pid,
            page: String(theNext),
            date,
            title,
            category: 12,
            title_cn: title_cn.result.toString()
          }
          Posts.push(post)
        } else {
          // Quick Releases
          const title = $$$('a').text()
          const summary = $$$('li').text()
          const link = $$$('a').attr('href')
          const summary_cn = await google.translate(summary)
          const pid = link.replace(/[^0-9]/ig, '')
          await crawShotPage(pid)
          const post = {
            pid,
            page: String(theNext),
            date,
            title,
            category: 11,
            summary,
            summary_cn: summary_cn.result.toString()
          }
          Posts.push(post)
        }
      }
    }
    if (cs === 'el-item item') {
      const title = $$('.mainlink a').text()
      const link = $$('.mainlink a').attr('href')
      const summary = $$('.desc').text()
      const pic = $$('.som').attr('src') || ''
      if (title && link && summary) {
        const title_cn = await google.translate(title)
        const summary_cn = await google.translate(summary)
        const pid = link.replace(/[^0-9]/ig, '')
        if (pic) request(pic).pipe(fs.createWriteStream(`${shotDir}/pic/${pid}.png`))
        await crawShotPage(pid)
        const post = {
          pid,
          page: String(theNext),
          date,
          title,
          title_cn:　title_cn.result.toString(),
          category,
          pic,
          summary,
          summary_cn: summary_cn.result.toString()
        }
        Posts.push(post)
      }
    }
  }
  await saveData()
  // console.log(Posts)
  await browser.close()
}

async function crawPage (id: number) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--enable-reader-mode=true'],
    dumpio: false
  })
  // Reader Mode triggering 显示简化版视图
  const page = await browser.newPage()
  await page.emulate(puppeteer.devices['Pixel 2 XL'])
  await page.goto(`https://javascriptweekly.com/link/${id}/web`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  })
  await page.screenshot({path: `imgs/${id}.png`, fullPage: true})
  await browser.close()
}

// crawPage(0)
crawJob()

// downloadImg()