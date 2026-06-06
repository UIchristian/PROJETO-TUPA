$body = '{"poligono":[
  { "lat": -16.4570, "lng": -46.9050 },
  { "lat": -16.4620, "lng": -46.9120 },
  { "lat": -16.4690, "lng": -46.9080 },
  { "lat": -16.4670, "lng": -46.8980 },
  { "lat": -16.4600, "lng": -46.8950 }
]}'
Invoke-RestMethod -Uri "http://localhost:8000/buscar-cars" -Method Post -ContentType "application/json" -Body $body