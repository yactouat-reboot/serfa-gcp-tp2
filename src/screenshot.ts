import puppeteer, { Browser } from "puppeteer";
import { Bucket, Storage } from "@google-cloud/storage";

async function initBrowser() {
  console.log("Initializing browser");
  return await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

async function takeScreenshot(browser: Browser, url: string) {
  const page = await browser.newPage();

  console.log(`Navigating to ${url}`);
  await page.goto(url);

  console.log(`Taking a screenshot of ${url}`);
  return await page.screenshot({
    fullPage: true,
  });
}

async function createStorageBucketIfMissing(storage: Storage, bucketName: string) {
  console.log(
    `Checking for Cloud Storage bucket '${bucketName}' and creating if not found`
  );
  const bucket = storage.bucket(bucketName);
  const [exists] = await bucket.exists();
  if (exists) {
    // Bucket exists, nothing to do here
    return bucket;
  }

  // Create bucket
  const [createdBucket] = await storage.createBucket(bucketName);
  console.log(`Created Cloud Storage bucket '${createdBucket.name}'`);
  return createdBucket;
}

async function uploadImage(bucket: Bucket, taskIndex: number, imageBuffer: Buffer) {
  // Create filename using the current time and task index
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  const filename = `${date.toISOString()}-task${taskIndex}.png`;

  console.log(`Uploading screenshot as '${filename}'`);
  await bucket.file(filename).save(imageBuffer);
}

async function main(urls: string[]) {
  console.log(`Passed in urls: ${urls}`);

  const taskIndex = (process.env.CLOUD_RUN_TASK_INDEX || 0) as number;
  const url = urls[taskIndex];
  if (!url) {
    throw new Error(
      `No url found for task ${taskIndex}. Ensure at least ${
        taskIndex + 1
      } url(s) have been specified as command args.`
    );
  }
  const bucketName = process.env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error(
      "No bucket name specified. Set the BUCKET_NAME env var to specify which Cloud Storage bucket the screenshot will be uploaded to."
    );
  }

  const browser = await initBrowser();
  const imageBuffer = await takeScreenshot(browser, url).catch(async (err) => {
    // Make sure to close the browser if we hit an error.
    await browser.close();
    throw err;
  });
  await browser.close();

  console.log("Initializing Cloud Storage client");
  const storage = new Storage();
  const bucket = await createStorageBucketIfMissing(storage, bucketName);
  await uploadImage(bucket, taskIndex, imageBuffer);

  console.log("Upload complete!");
}

main(process.argv.slice(2)).catch((err) => {
  console.error(JSON.stringify({ severity: "ERROR", message: err.message }));
  process.exit(1);
});
