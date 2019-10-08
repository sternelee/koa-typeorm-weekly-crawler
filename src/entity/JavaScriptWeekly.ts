import {Column, Entity, PrimaryGeneratedColumn} from "typeorm"

@Entity()
export class JavaScriptWeekly {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    pid: string

    @Column()
    page: string

    @Column()
    date: string

    @Column()
    category: number

    @Column()
    title: string

    @Column()
    title_cn?: string

    @Column()
    link?: string

    @Column()
    img?: string

    @Column()
    pic?: string

    @Column()
    summary?: string

    @Column()
    summary_cn?: string

}