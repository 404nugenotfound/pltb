import { processWeatherNlp } from "./lib/nlp/pipeline"

const testCases = [
  { id: "case-001", input: { tempC:24, tempF:75, feelslikeC:23, feelslikeF:73, humidity:50, weatherPrimary:"Sunny", windSpeedKPH:8, windSpeedMPH:5, windDir:"N", windDirDEG:0, windGustKPH:12, uvi:3, visibilityKM:20, pop:0, sky:10, place:{name:"Jakarta",state:"DKI Jakarta",country:"Indonesia"} } },
  { id: "case-008", input: { tempC:29, tempF:84, feelslikeC:30, feelslikeF:86, humidity:65, weatherPrimary:"Light Rain", windSpeedKPH:18, windSpeedMPH:11, windDir:"SW", windDirDEG:225, windGustKPH:25, uvi:4, visibilityKM:10, pop:55, sky:85, place:{name:"Yogyakarta",state:"DIY",country:"Indonesia"} } },
  { id: "case-013", input: { tempC:22, tempF:72, feelslikeC:21, feelslikeF:70, humidity:55, weatherPrimary:"Mostly Sunny", windSpeedKPH:3, windSpeedMPH:2, windDir:"ESE", windDirDEG:112.5, windGustKPH:5, uvi:5, visibilityKM:25, pop:0, sky:25, place:{name:"Medan",state:"Sumatera Utara",country:"Indonesia"} } },
  { id: "case-015", input: { tempC:26, tempF:79, feelslikeC:27, feelslikeF:81, humidity:72, weatherPrimary:"Drizzle", windSpeedKPH:10, windSpeedMPH:6, windDir:"SSE", windDirDEG:157.5, windGustKPH:15, uvi:2, visibilityKM:8, pop:40, sky:90, place:{name:"Padang",state:"Sumatera Barat",country:"Indonesia"} } },
]

for (const tc of testCases) {
  const r = processWeatherNlp(tc.input)
  console.log(`${tc.id}:`)
  console.log(`  NARRATIVE: "${r.summary}"`)
  console.log(`  KEYPHRASE: "${r.keyPhrase}"`)
  console.log(`  ADVICE: ${JSON.stringify(r.advice)}`)
  console.log()
}