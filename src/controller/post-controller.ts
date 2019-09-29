import { getManager } from 'typeorm'
import { JavaScriptWeekly } from "../entity/JavaScriptWeekly"

export default class PostController {
  static async index(ctx) {
    const postRepository = getManager().getRepository(JavaScriptWeekly)
    ctx.body = {
      all: 'weekly data'
    };
  }
  static async findPost (ctx) {
    const page = ctx.query.p || ''
    console.log(page)
    const postRepository = getManager().getRepository(JavaScriptWeekly)
    const posts = await postRepository.find({ where: { page }})
    ctx.body = posts
  }
}