import fs from 'fs'
import path from 'path'

function isAllCapsTitle (line: string) : boolean {
	return line.toUpperCase() === line && line.length > 3
}

function isTitle (line: string) : boolean {
	if (isAllCapsTitle(line)) {
		return true
	}
	if (isSectionHeading(line)) {
		return true
	}
	return !!line.split(/\d+\s?/).join('').match(/^[A-Z][a-z]+(\s[A-Z][a-z]+)$/)
}

function isListLine (line: string) : boolean {
	return !!line.match(/^[0-9]\./) || line.startsWith('•')
}

function isEndingLine (line: string) {
	return line.endsWith('.') || line.endsWith(':') || line.endsWith('!') || line.endsWith('?')
}

function isLineJustANumber (line: string) {
	return !!line.match(/^[0-9]+$/)
}

function isSectionHeading (line: string) {
	return !!line.match(/^([0-9]\.?)+ ([A-Z][a-z]+\s?)+$/) && line.length > 10
}

function convertPDFCopy (copiedText: string) : string {
	const lines = copiedText.split('\n')
	const outputLines = []
	const sectionHeaders : string[] = []
	lines.forEach((line) => {
		line = line.trim()
		console.log('-----')
		console.log('line', line)
		if (!line) {
			console.log('just a blank line')
			outputLines.push('')
			return
		}
		console.log('is chapter header?', isSectionHeading(line))

		if (isSectionHeading(line)) {
			console.log('this line is a chapter header')
			const exists = sectionHeaders.includes(line.toLowerCase())
			console.log('exists', exists)
			if (exists) {
				console.log('we have seen this chapter header before')
				return
			}
			console.log('sectionheaders', sectionHeaders)
			sectionHeaders.push(line.toLowerCase())
		}

		const prevLine = outputLines[outputLines.length - 1] || ''
		const nextLine = outputLines[outputLines.length + 1] || ''
		console.log('prevLine', prevLine)
		console.log('prevLine is title?', isTitle(prevLine))

		if (isLineJustANumber(line)) {
			if (!isLineJustANumber(prevLine) && !isLineJustANumber(nextLine)) {
				console.log('a lone line with just a number is probably a page number, we shall remove it')
				return
			}
		}


		let appendToLast = true
		let newParagraph = false
		if (isEndingLine(prevLine)) {
			console.log('prev line is an ending line')
			appendToLast = false
		}
		else if (isTitle(prevLine)) {
			console.log('previous line appears to be a title')
			appendToLast = false
		}
		else if (isListLine(prevLine) && !isSectionHeading(prevLine)) {
			console.log('prev line starts with a number')
			appendToLast = !isListLine(line)
		}
		else if (isListLine(line)) {
			console.log('this line starts with a number')
			appendToLast = false
		}

		if (isAllCapsTitle(line)) {
			console.log('this line is a title, let us add some space')
			newParagraph = true
			appendToLast = false
		}

		if (!isListLine(line) && isListLine(prevLine) && !isSectionHeading(prevLine)) {
			newParagraph = true
		}

		if (line.match(/^([A-Z]\s?)+$/) && !line.match(/[A-Z]{2,}/)) {
			console.log('this line looks like a T I T L E I N T H I S F O R M A T')
			line = line.split(' ').join('')
			console.log('after', line)
		}

		if (appendToLast) {
			if (!prevLine) {
				console.log('no previous line to append to')
				outputLines.push(line)
			}
			else {
				console.log('appending to previous line')
				outputLines[outputLines.length - 1] = prevLine + ' ' + line
			}
		}
		else {
			outputLines.push((newParagraph ? '\n' : '') + line)
		}
	})

	console.log('Went from ' + lines.length + ' lines to ' + outputLines.length + ' lines')
	return outputLines.join('\n')
}

(async function () {
	const sourceDir = path.join(__dirname, 'source-files')
	const outputDir = path.join(__dirname, 'converted-files')
	const removals = (fs.readFileSync(path.join(__dirname, 'removals.txt'), 'utf8') || '')
		.split('\n')
		.map(x => x.trim())
		.filter(x => !!x)

	function stripRemovals (input: string) {
		removals.forEach((remove) => {
			console.log('let us remove', remove)

			if (remove.startsWith('/')) {
				const lines = input.split('\n')
				const reg = new RegExp(remove.substring(1, remove.length - 1))
				console.log('removing lines matching', reg,'. Starting with ' + lines.length + ' lines')
				console.log('reg', reg)
				const filtered = lines.filter((line) => {
					return !line.match(reg)
				})
				console.log('Removed', lines.length - filtered.length, 'lines')
				input = filtered.join('\n')
				return
			}

			const splitter = remove.startsWith('/') ? new RegExp(remove) : remove
			const split = input.split(splitter)
			if (split.length > 1) {
				console.log(`Removing ${split.length-1} instances of ${splitter}`)
			}
			input = split.join('')
		})

		return input
	}

	const files = fs.readdirSync(sourceDir)
	const convertedFiles : string[] = []
	const finalFile = 'Comp2831.txt'

	const onlyFile = 'test.txt'

	files.forEach((file) => {
		if (onlyFile && file !== onlyFile) {
			return
		}

		if (file.startsWith('_')) {
			console.log('Skipping underscored file', file)
			return
		}
		const copiedText = fs.readFileSync(path.join(sourceDir, file), 'utf8')
		const stripped = stripRemovals(copiedText)
		let converted = convertPDFCopy(stripped)
		converted = stripRemovals(converted)
		converted = converted.split(/[\r\n]{3,}/).join('\n\n')
		convertedFiles.push(converted)
		fs.writeFileSync(path.join(outputDir, file), converted)
	})

	fs.writeFileSync(path.join(outputDir, finalFile), convertedFiles.join('\n\n\n\n'))
})()
