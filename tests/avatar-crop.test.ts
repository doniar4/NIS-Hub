import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarCrop } from '../src/lib/avatar-crop';
test('crop stays within portrait and landscape sources at every zoom and drag edge',()=>{
  for(const [width,height] of [[600,400],[400,600],[400,400]]) for(const zoom of [0,1,2,4,10]) for(const x of [-2,-1,0,1,2]) for(const y of [-2,-1,0,1,2]) {
    const crop=avatarCrop(width,height,zoom,x,y);
    assert.ok(crop.size>0 && crop.left>=0 && crop.top>=0);
    assert.ok(crop.left+crop.size<=width && crop.top+crop.size<=height);
  }
  assert.deepEqual(avatarCrop(600,400,2,1,0),{size:200,left:400,top:100});
});
