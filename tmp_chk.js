var d=JSON.parse(require('fs').readFileSync('./public/lighthouse-scores.json','utf8'));
var p=Object.entries(d.pages||{});
var scored=0,failed=0,four04=0,zero=0;
p.forEach(function(e){var v=e[1];if(v.status===404)four04++;else if(v.score>0)scored++;else if(v.score===0)zero++;else if(v.error)failed++;});
console.log('Total:',p.length,'| Scored:',scored,'| Score=0:',zero,'| 404:',four04,'| Failed:',failed);
