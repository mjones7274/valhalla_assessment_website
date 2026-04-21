const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function setupProxy(app) {
  app.use(
    "/pdf-proxy",
    createProxyMiddleware({
      target: "https://www.valhallahealthassessments.com",
      changeOrigin: true,
      secure: true,
      pathRewrite: {
        "^/pdf-proxy": "",
      },
    })
  );
};
