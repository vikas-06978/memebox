'use strict';
MemeRoomI18n.ready.then(() => {
const {t}=MemeI18n, products=MemeShop.products, currency=document.getElementById('currency');
const shopOpen=MEMEBOX_CONFIG.SHOP_OPEN===true && !MEMEBOX_CONFIG.SITE_URL.startsWith('http://127.0.0.1:');
document.getElementById('shop-status').textContent=t(shopOpen?'plans_checkout_help':'plans_closed');
const tierSelect=document.getElementById('pass-tier'),wantedTier=new URLSearchParams(location.search).get('tier');
if(['pro','max'].includes(wantedTier))tierSelect.value=wantedTier;
const price=p=>currency.value==='usd'?'$'+Number(p.usd).toFixed(2):'₹'+p.inr;
function entry(title,p,status,productId=''){
  const card=document.createElement('article'),heading=document.createElement('h3');heading.textContent=title;card.append(heading);
  if(p){const amount=document.createElement('p');amount.className='price';amount.textContent=price(p);card.append(amount);}
  const label=document.createElement('p');label.className='status';label.textContent=status;card.append(label);
  const link=document.createElement('a');link.className='button';
  if(p && !p.closed && shopOpen){const url=new URL('/buy',MEMEBOX_CONFIG.SITE_URL);url.searchParams.set('product',productId);link.href=url.href;link.textContent=t('plans_open_checkout');link.target='_blank';link.rel='noopener noreferrer';}
  else if(status===t('plans_max_only')){link.href='plans.html?tier=max#passes';link.textContent=t('plans_view_max');}
  else if(p?.closed){link.href='plans.html?tier=pro#passes';link.textContent=t('plans_passes');}
  else if(p){link.href='#shop-status';link.textContent=t('plans_availability');}
  else{link.href='playground.html';link.textContent='Playground';}
  card.append(link);return card;
}
function render(){
 document.getElementById('pass-list').replaceChildren(...Object.entries(products).filter(([id,p])=>id.startsWith('pass_')&&(tierSelect.value==='all'||(tierSelect.value==='max'?p.maxSeconds>0:p.proSeconds>0))).map(([id,p])=>entry(p.name,p,shopOpen?t('plans_checkout_help'):t('plans_closed'),id)));
 document.getElementById('character-list').replaceChildren(...Object.entries(products).filter(([id,p])=>(id.startsWith('char_')||id==='chars_eight')&&!p.closed).map(([id,p])=>entry(p.name,p,t('plans_forever'),id)));
 const filterCards=MemeFx.FILTERS.filter(id=>id!=='none').map(id=>{const p=products['filter_'+id],free=MemeFx.FREE_FILTERS.includes(id);return entry(t('fx_filter_'+id),p,free?t('fx_tier_free'):p?(p.closed?t('plans_draft'):t('plans_forever')):t('plans_max_only'),'filter_'+id)});
 if(products.filters_fifteen)filterCards.splice(MemeFx.FREE_FILTERS.length,0,entry(products.filters_fifteen.name,products.filters_fifteen,t('plans_forever'),'filters_fifteen'));
 document.getElementById('filter-list').replaceChildren(...filterCards);
 const outfitCards=MemeFx.OUTFITS.filter(id=>id!=='none').map(id=>{const p=products['outfit_'+id],free=MemeFx.FREE_OUTFITS.includes(id);return entry(t('fx_outfit_'+id),p,free?t('fx_tier_free'):p?(p.closed?t('plans_draft'):t('plans_forever')):t('plans_max_only'),'outfit_'+id)});
 if(products.outfits_three)outfitCards.splice(MemeFx.FREE_OUTFITS.length,0,entry(products.outfits_three.name,products.outfits_three,t('plans_forever'),'outfits_three'));
 document.getElementById('outfit-list').replaceChildren(...outfitCards);
}
currency.addEventListener('change',render);tierSelect.addEventListener('change',render);render();

});
