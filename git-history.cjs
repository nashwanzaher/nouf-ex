const { execSync } = require('node:child_process');
const path = require('node:path');
const gitPath = 'C:/Program Files/Git/bin/git.exe';
const cwd = 'C:/Users/zaher/Desktop/nouf-ex';

function git(args) {
	return execSync(`"${gitPath}" ${args}`, {
		encoding: 'utf8',
		cwd,
		stdio: ['ignore', 'pipe', 'pipe'],
	});
}

// Get last 20 commits touching test-token.ts
console.log('=== test-token.ts history ===');
try {
	const out = git('log --oneline -20 -- app/server/tests/test-token.ts');
	console.log(out);
} catch (e) {
	console.log('ERROR:', e.message);
}

// Show last commit's test-token.ts content
console.log('\n=== HEAD:test-token.ts ===');
try {
	const out = git('show HEAD:app/server/tests/test-token.ts');
	console.log(out.substring(0, 1500));
} catch (e) {
	console.log('ERROR:', e.message);
}

console.log('\n=== Last commit hash ===');
try {
	console.log(git('log -1 --oneline'));
} catch (e) {}

// Delete this script
try {
	require('node:fs').unlinkSync(path.join(cwd, 'git-history.cjs'));
} catch (e) {}