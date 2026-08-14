
export async function GET(){
  const lat=41.1468, lon=-73.4948;
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&current=temperature_2m&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=2`;
  try{
    const r=await fetch(url,{next:{revalidate:900}});
    const d=await r.json();
    return Response.json({
      current:Math.round(d.current?.temperature_2m),
      high:Math.round(d.daily?.temperature_2m_max?.[0]),
      low:Math.round(d.daily?.temperature_2m_min?.[0]),
      precip:Math.round(d.daily?.precipitation_probability_max?.[0]||0)
    });
  }catch(e){return Response.json({error:"weather unavailable"},{status:503})}
}
