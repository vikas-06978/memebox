// Read the real closed-shadow panel through Chrome DevTools, without changing app isolation.
export async function panelElement(page, selector) {
  const session = await page.context().newCDPSession(page);
  try {
    const { root } = await session.send('DOM.getDocument', { depth: -1, pierce: true });
    const find = node => {
      if (node.shadowRootType === 'closed') return node;
      for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) {
        const result = find(child); if (result) return result;
      }
    };
    const shadow = find(root);
    if (!shadow) throw new Error('MemeBox closed-shadow panel not found');
    const { object } = await session.send('DOM.resolveNode', { nodeId: shadow.nodeId });
    const result = await session.send('Runtime.callFunctionOn', {
      objectId: object.objectId, returnByValue: true,
      functionDeclaration: 'function(selector) { const el=this.querySelector(selector); if(!el) throw Error("Panel element missing: "+selector); el.scrollIntoView({block:"center",inline:"nearest"}); const r=el.getBoundingClientRect(); return {text:el.textContent, x:r.x+r.width/2, y:r.y+r.height/2, width:r.width, height:r.height}; }',
      arguments: [{ value: selector }],
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  } finally { await session.detach(); }
}
export async function clickPanel(page, selector) {
  const element = await panelElement(page, selector);
  if (!element.width || !element.height) throw new Error('Panel element is hidden: ' + selector);
  await page.mouse.click(element.x, element.y);
}
