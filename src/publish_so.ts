import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync } from "fs";
import { basename } from "path";

const execPromise = promisify(exec);
dotenv.config();

async function generateFileChecksum(
  inPath: string,
  outPath: string,
  executablePath = "target/release/zkpass-md5-checksum"
) {
  const { stderr } = await execPromise(
    `${executablePath} --in ${inPath} --out ${outPath}`
  );
  if (stderr && stderr.length > 0) throw new Error(stderr);
}

async function uploadReleaseAsset(path: string) {
  /**
   * Github fine-grained user access token.
   * Can also be Github App user access tokens or Github App installation access
   * tokens.
   */
  const token = process.env.ACCESS_TOKEN!;

  // Github repostiory owner
  const owner = process.env.OWNER!;

  // Github repository
  const repo = process.env.REPO!;

  // Release Tag
  const tag = process.env.RELEASE_TAG!;

  // Release asset file name
  const name = basename(path);

  // Release asset data
  const data = readFileSync(path).toString();

  /**
   * Octokit is the official client for the GitHub API
   * https://github.com/octokit
   */
  const octokit = new Octokit({
    auth: token,
  });

  /**
   * Get release by tag
   */
  const release = await octokit.rest.repos.getReleaseByTag({
    owner,
    repo,
    tag,
  });
  const releaseId = release.data.id;

  /**
   * Get release asset. If exists, delete.
   */
  const releaseAssets = await octokit.rest.repos.listReleaseAssets({
    owner,
    release_id: releaseId,
    repo,
  });
  const releaseAsset = releaseAssets.data.find((d) => d.name === name);
  if (releaseAsset)
    await octokit.rest.repos.deleteReleaseAsset({
      owner,
      repo,
      asset_id: releaseAsset.id,
    });

  /**
   * Upload release asset
   */
  await octokit.rest.repos.uploadReleaseAsset({
    owner,
    repo,
    release_id: releaseId,
    name,
    data,
  });
}

async function main() {
  const r0LibPath = "target/release/libr0_zkpass_query.so";
  const r0LibChecksum = "target/release/libr0_zkpass_query.md5";
  const sp1LibPath = "target/release/libsp1_zkpass_query.so";
  const sp1LibChecksum = "target/release/libsp1_zkpass_query.md5";

  // generate checksum
  await generateFileChecksum(r0LibPath, r0LibChecksum);
  await generateFileChecksum(sp1LibPath, sp1LibChecksum);

  // upload release asset
  await uploadReleaseAsset(r0LibPath);
  await uploadReleaseAsset(r0LibChecksum);
  await uploadReleaseAsset(sp1LibPath);
  await uploadReleaseAsset(sp1LibChecksum);
}

main().catch(console.error);
