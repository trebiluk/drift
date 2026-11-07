import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { PAGE_BG, PAGE_LEVEL, PAGE_RGB, levelColor } from "./page.ts"

test("the page colour is a mid sky blue, about half bright, never white or dark", () => {
  assert.match(PAGE_BG, /^#[0-9a-f]{6}$/)
  assert.ok(PAGE_LEVEL > 0.45 && PAGE_LEVEL < 0.55, `page brightness ${PAGE_LEVEL.toFixed(3)}`)
})

test("index.html paints the same colour on the html and body elements and as the theme colour, so the first paint is never white", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8")
  assert.ok(html.includes(`<html lang="en" style="background:${PAGE_BG}">`))
  assert.ok(html.includes(`<body style="margin:0;background:${PAGE_BG}">`))
  assert.ok(html.includes(`<meta name="theme-color" content="${PAGE_BG}" />`))
  assert.ok(!/#fff(fff)?\b|white/i.test(html.replace(/<title>.*<\/title>/, "")), "no white anywhere in the page shell")
})

test("main.tsx takes its background from the same constant", () => {
  const main = readFileSync(new URL("../main.tsx", import.meta.url), "utf8")
  assert.ok(main.includes("PAGE_BG"), "main.tsx uses PAGE_BG")
  assert.ok(!main.includes("'#5c92c6'") && !main.includes("#8ec9f0"), "no older page colour is left")
})

test("a flat stand-in colour for the picture reads the brightness it is asked for, within a point", () => {
  const luma = (css: string) => {
    const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(css)
    assert.ok(m, css)
    return (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255
  }
  for (const want of [0.4, 0.45, 0.5, 0.55, 0.6]) assert.ok(Math.abs(luma(levelColor(want)) - want) < 0.01, `${want}: ${levelColor(want)}`)
  assert.equal(levelColor(PAGE_LEVEL), `rgb(${PAGE_RGB[0]}, ${PAGE_RGB[1]}, ${PAGE_RGB[2]})`)
  assert.equal(levelColor(NaN), levelColor(PAGE_LEVEL), "a bad number gives the page colour")
  for (const v of [-1, 0, 5, Infinity]) assert.ok(/^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/.test(levelColor(v)), `${v} stays a valid colour`)
})
