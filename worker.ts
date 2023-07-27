const HTML_TEMPLATE = `
<html>
  <head>
    <title>R2 File Uploader</title>
    <style>
      body {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
        background-color: #fafafa;
        font-family: Arial, sans-serif;
      }
      .box {
        border: 1px solid #ddd;
        border-radius: 5px;
        padding: 20px;
        background-color: #fff;
        box-shadow: 0 2px 5px rgba(0,0,0,0.15);
      }
      .center {
        text-align: center;
      }
      textarea {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 10px;
      box-sizing: border-box;
      font-family: Arial, sans-serif;
      resize: none; /* Disables resizing the textarea */
      }
    </style>
  </head>
  <body>
    <div class="box">
      $content$
    </div>
  </body>
</html>`;

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);

    switch (request.method) {
      case 'PUT': {
        await env.MY_BUCKET.put(key, request.body);
        return new Response(`Object ${key} uploaded successfully!`);
      }

      case 'GET': {
        if (!key) {
          const fileListObject = await env.MY_BUCKET.get('file-list.txt');
          let fileListHtml = '<p>No files uploaded yet.</p>';
          if (fileListObject !== null) {
            const fileList = await fileListObject.text();
            const files = fileList.split('\\n').filter(Boolean);
            fileListHtml = files.map(file => `<p><a href="${url.origin}/${file}">${file}</a> <a href="${url.origin}/delete/${file}">[Delete]</a></p>`).join('');
          }
          const content = `<h1>List of Files</h1>${fileListHtml}<div class="separator"></div><form action="/" method="post" enctype="multipart/form-data"><input type="file" name="file"><button type="submit">Upload File</button></form><p>Note: Same-named uploads replace old files.</p>`;
          const html = HTML_TEMPLATE.replace('$content$', content);
          return new Response(html, { headers: { 'Content-Type': 'text/html' } });
        }

        if (key.startsWith('delete/')) {
          const fileName = key.slice(7);
          await env.MY_BUCKET.delete(fileName);
          const fileListObject = await env.MY_BUCKET.get('file-list.txt');
          let fileList = '';
          if (fileListObject !== null) {
            fileList = await fileListObject.text();
          }
          fileList = fileList.split('\\n').filter(file => file !== fileName).join('\\n');
          await env.MY_BUCKET.put('file-list.txt', new TextEncoder().encode(fileList));
          const content = `<p>Object <b>${fileName}</b> deleted successfully!</p><div class="center"><button onclick="window.location.href='${url.origin}'">Go Back</button></div>`;
          const html = HTML_TEMPLATE.replace('$content$', content);
          return new Response(html, { headers: { 'Content-Type': 'text/html' } });
        }

        const object = await env.MY_BUCKET.get(key);
        if (object === null) {
          return new Response('Object Not Found', { status: 404 });
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        return new Response(object.body, { headers });
      }

      case 'POST': {
        const formData = await request.formData();
        const file = formData.get('file');
        const fileName = file.name;
        await env.MY_BUCKET.put(fileName, file.stream());
        const fileListObject = await env.MY_BUCKET.get('file-list.txt');
        let fileList = '';
        if (fileListObject !== null) {
          fileList = await fileListObject.text();
        }
        fileList += fileName + '\\n';
        await env.MY_BUCKET.put('file-list.txt', new TextEncoder().encode(fileList));
        const content = `<p>Object <b>${fileName}</b> uploaded successfully!</p><p>The file is available at:</p><p><a href="${url.origin}/${fileName}">${url.origin}/${fileName}</a></p><textarea readonly>${url.origin}/${fileName}</textarea><p></p><div class="center"><button onclick="window.location.href='${url.origin}'">Go Back</button></div>`;
        const html = HTML_TEMPLATE.replace('$content$', content);
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
      }

      default:
        return new Response('Method not supported', { status: 405 });
    }
  },
};
