import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
test('archived CI and staging logs preserve failing command exit status',()=>{
  for(const name of ['ci','staging-acceptance']) {
    const workflow=readFileSync(new URL(`../.github/workflows/${name}.yml`,import.meta.url),'utf8');
    assert.match(workflow,/defaults:\s*run:\s*shell: bash/);
  }
  const result=spawnSync('bash',['--noprofile','--norc','-eo','pipefail','-c','(exit 7) 2>&1 | tee /dev/null']);
  assert.equal(result.status,7);
});
