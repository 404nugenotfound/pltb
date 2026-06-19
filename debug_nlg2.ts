import { processWeatherNlp } from "./lib/nlp/pipeline"

const cases = [
  { id: "case-020", hints: ["dingin","kering"], input: { tempC:10, tempF:50, feelslikeC:8, feelslikeF:46, humidity:20, weatherPrimary:"Overcast", windSpeedKPH:2, windSpeedMPH:1, windDir:"N", windDirDEG:0, windGustKPH:3, uvi:2, visibilityKM:10, pop:20, sky:100, place:{name:"Puncak",state:"Jawa Barat",country:"Indonesia"} } },
  { id: "case-021", hints: ["dingin","beku","kabut"], input: { tempC:0, tempF:32, feelslikeC:-5, feelslikeF:23, humidity:60, weatherPrimary:"Overcast", windSpeedKPH:10, windSpeedMPH:6, windDir:"N", windDirDEG:0, windGustKPH:15, uvi:0, visibilityKM:5, pop:30, sky:100, place:{name:"Dieng",state:"Jawa Tengah",country:"Indonesia"} } },
  { id: "case-023", hints: ["angin","badai"], input: { tempC:28, tempF:82, feelslikeC:29, feelslikeF:84, humidity:50, weatherPrimary:"Partly Cloudy", windSpeedKPH:100, windSpeedMPH:62, windDir:"W", windDirDEG:270, windGustKPH:130, uvi:2, visibilityKM:10, pop:5, sky:60, place:{name:"Anyer",state:"Banten",country:"Indonesia"} } },
  { id: "case-024", hints: ["hangat","nyaman","sejuk"], input: { tempC:25, tempF:77, feelslikeC:25, feelslikeF:77, humidity:55, weatherPrimary:"Mostly Cloudy", windSpeedKPH:12, windSpeedMPH:7, windDir:"NNE", windDirDEG:22.5, windGustKPH:18, uvi:4, visibilityKM:20, pop:10, sky:65, place:{name:"Bandung",state:"Jawa Barat",country:"Indonesia"} } },
]

for (const tc of cases) {
  const r = processWeatherNlp(tc.input)
  const narr = r.summary.toLowerCase()
  const matches = tc.hints.filter(h => narr.includes(h))
  console.log(`${tc.id}: found=${matches.length}/${tc.hints.length}`)
  console.log(`  MATCHES: ${matches.join(", ") || "none"}`)
  console.log(`  NARRATIVE: "${r.summary.slice(0, 120)}..."`)
  console.log(`  KEYPHRASE: "${r.keyPhrase}"`)
  console.log()
}