const process = require("process");
const core = require("@actions/core");
const github = require("@actions/github");
const yaml = require("js-yaml");

process.on('uncaughtException', (reason) => core.setFailed(reason));
process.on('unhandledRejection', (reason) => core.setFailed(reason));

core.startGroup("resolve failure statuses");
const failure_statuses = failureStatuses();
core.endGroup();

const gh_token = core.getInput('github-token', { required: true });
const octokit = github.getOctokit(gh_token);

run();

async function run() {
	const [ancestors, failures] = await Promise.all([
		get_ancestor_jobs(),
		get_failed_jobs()]);

	for (const failure of failures) {
		const name = failure.name
		if (ancestors.some(match => match(name))) {
			core.setFailed(`job ${name} failed: ${failure.html_url}`);
			return
		}
	}

	core.info("Success!");
}

async function get_ancestor_jobs() {
	const id = await core.group("load workflow ID", () => {
		return octokit.actions.getWorkflowRun({
			...github.context.repo,
			run_id: github.context.runId,
		}).then((res) => res.data.workflow_id);
	});

	const path = await core.group(`load workflow path: ${id}`, () => {
		return octokit.actions.getWorkflow({
			...github.context.repo,
			workflow_id: id,
		}).then((res) => res.data.path);
	});

	const file = await core.group(`load workflow file: ${path}`, () => {
		return octokit.repos.getContent({
			...github.context.repo,
			path: path,
			ref: github.context.sha,
			mediaType: { format: "raw" }
		}).then((res) => {
			return res.data
		});
	});

	core.startGroup("parse workflow");
	const workflow = yaml.load(file);
	core.endGroup();

	core.startGroup("collect ancestors")
	const ancestors = collect_ancestors(workflow);
	core.endGroup();

	return ancestors;
}

function collect_ancestors(workflow) {
	const ancestors = new Set();
	const needs = [github.context.job];
	const jobs = workflow.jobs || {};

	while (needs.length > 0) {
		const need = needs.pop();

		const job = jobs[need];
		if (!job) {
			core.warning(`no job with ID: ${need}`);
			continue;
		}

		if (!job.needs) {
			core.debug(`no needs on job: ${need}`);
			continue;
		}

		job.needs.forEach(el => {
			if (!ancestors.has(el)) {
				core.info(`job ${need} needs: ${el}`)
				ancestors.add(el);
				needs.push(el);
			}
		});
	}

	const out = [];
	ancestors.forEach(a => {
		let job = jobs[a];
		job.job_id = a;
		out.push(jobMatcher(job));
	});
	return out
}

function jobMatcher(job) {
	const strategy = job.strategy || {};
	const matrix = strategy.matrix;
	const job_name = job.name || job.job_id;

	return (name) => matrix
		? name.startsWith(job_name + " (")
		: name == job_name;
}

async function get_failed_jobs() {
	const statuses = await core.group("load job statuses", () => {
		return octokit.paginate(octokit.actions.listJobsForWorkflowRun, {
			...github.context.repo,
			run_id: github.context.runId,
			filter: "latest",
		});
	});

	return statuses.filter((status) => failure_statuses.has(status.conclusion))
}

function failureStatuses() {
	const statuses = JSON.parse(core.getInput('failure-statuses', { required: true }));
	core.info(`failing statuses: ${statuses}`);

	const out = new Set();
	statuses.forEach(el => out.add(el));

	return out
}
