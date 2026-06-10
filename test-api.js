const fetch = require('node-fetch');

async function test() {
  try {
    const res = await fetch('https://api.pokemontcg.io/v2/cards?q=name:%22*charizard*%22&pageSize=10');
    console.log(res.status);
    const data = await res.json();
    console.log(data.data ? data.data.length : 'no data');
  } catch (e) {
    console.error(e);
  }
}

test();
