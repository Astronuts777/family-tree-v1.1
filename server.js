const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const HOST = "127.0.0.1";
const PORT = 3000;
const PROJECT_ROOT = __dirname;
const DATABASE_DIR = path.join(PROJECT_ROOT, "data");
const DATABASE_PATH = path.join(DATABASE_DIR, "family-tree.db");

fs.mkdirSync(DATABASE_DIR, { recursive: true });

const database = new DatabaseSync(DATABASE_PATH);

database.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    death_date TEXT,
    address TEXT,
    ethnicity TEXT,
    job_title TEXT,
    marital_status TEXT,
    photo_data_url TEXT,
    spouse_name TEXT,
    spouse_birth_date TEXT,
    spouse_death_date TEXT,
    spouse_job_title TEXT,
    spouse_marital_status TEXT,
    spouse_calculated_age TEXT,
    calculated_age TEXT NOT NULL,
    parent_ids TEXT NOT NULL,
    sibling_ids TEXT NOT NULL,
    spouse_ids TEXT NOT NULL
  )
`);

const selectMembersStatement = database.prepare(`
  SELECT
    id,
    name,
    gender,
    birth_date,
    death_date,
    address,
    ethnicity,
    job_title,
    marital_status,
    photo_data_url,
    spouse_name,
    spouse_birth_date,
    spouse_death_date,
    spouse_job_title,
    spouse_marital_status,
    spouse_calculated_age,
    calculated_age,
    parent_ids,
    sibling_ids,
    spouse_ids
  FROM members
  ORDER BY id ASC
`);

const insertMemberStatement = database.prepare(`
  INSERT INTO members (
    id,
    name,
    gender,
    birth_date,
    death_date,
    address,
    ethnicity,
    job_title,
    marital_status,
    photo_data_url,
    spouse_name,
    spouse_birth_date,
    spouse_death_date,
    spouse_job_title,
    spouse_marital_status,
    spouse_calculated_age,
    calculated_age,
    parent_ids,
    sibling_ids,
    spouse_ids
  ) VALUES (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?
  )
`);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(JSON.stringify(payload));
}

function parseRequestBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";

    request.on("data", (chunk) => {
      data += chunk;
    });

    request.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error("请求体不是合法 JSON"));
      }
    });

    request.on("error", reject);
  });
}

function mapDatabaseRow(row) {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    birthDate: row.birth_date,
    deathDate: row.death_date || "",
    address: row.address || "",
    ethnicity: row.ethnicity || "",
    jobTitle: row.job_title || "",
    maritalStatus: row.marital_status || "",
    photoDataUrl: row.photo_data_url || "",
    spouseName: row.spouse_name || "",
    spouseBirthDate: row.spouse_birth_date || "",
    spouseDeathDate: row.spouse_death_date || "",
    spouseJobTitle: row.spouse_job_title || "",
    spouseMaritalStatus: row.spouse_marital_status || "",
    spouseCalculatedAge: row.spouse_calculated_age || "",
    calculatedAge: row.calculated_age,
    parentIds: JSON.parse(row.parent_ids || "[]"),
    siblingIds: JSON.parse(row.sibling_ids || "[]"),
    spouseIds: JSON.parse(row.spouse_ids || "[]"),
  };
}

function saveMembers(members) {
  try {
    database.exec("BEGIN TRANSACTION");
    database.exec("DELETE FROM members");

    members.forEach((member) => {
      insertMemberStatement.run(
        member.id,
        member.name,
        member.gender,
        member.birthDate,
        member.deathDate || "",
        member.address || "",
        member.ethnicity || "",
        member.jobTitle || "",
        member.maritalStatus || "",
        member.photoDataUrl || "",
        member.spouseName || "",
        member.spouseBirthDate || "",
        member.spouseDeathDate || "",
        member.spouseJobTitle || "",
        member.spouseMaritalStatus || "",
        member.spouseCalculatedAge || "",
        member.calculatedAge,
        JSON.stringify(member.parentIds || []),
        JSON.stringify(member.siblingIds || []),
        JSON.stringify(member.spouseIds || []),
      );
    });

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function serveStaticFile(requestPath, response) {
  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(PROJECT_ROOT, normalizedPath);

  if (!filePath.startsWith(PROJECT_ROOT)) {
    sendJson(response, 403, { error: "禁止访问" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "文件不存在" });
      return;
    }

    const extension = path.extname(filePath);
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    };

    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "text/plain; charset=utf-8",
    });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/members" && request.method === "GET") {
    const members = selectMembersStatement.all().map(mapDatabaseRow);
    sendJson(response, 200, { members });
    return;
  }

  if (url.pathname === "/api/members" && request.method === "PUT") {
    try {
      const body = await parseRequestBody(request);
      const members = Array.isArray(body.members) ? body.members : [];
      saveMembers(members);
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  serveStaticFile(url.pathname, response);
});

server.listen(PORT, HOST, () => {
  console.log(`Family tree app running at http://${HOST}:${PORT}`);
  console.log(`SQLite database: ${DATABASE_PATH}`);
});
