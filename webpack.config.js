const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const devCerts = require("office-addin-dev-certs");

const urlDev = "https://localhost:3000/";

module.exports = async (env, options) => {
  const dev = options.mode === "development";

  const config = {
    devtool: "source-map",
    entry: {
      taskpane: ["./src/taskpane/index.tsx"],
      commands: ["./src/commands/commands.ts"],
      webapp: ["./src/webapp/index.tsx"],
    },
    output: {
      clean: true,
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
    },
    resolve: {
      extensions: [".ts", ".tsx", ".html", ".js"],
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["taskpane"],
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["commands"],
      }),
      new HtmlWebpackPlugin({
        filename: "webapp.html",
        template: "./src/webapp/webapp.html",
        chunks: ["webapp"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "assets/*",
            to: "assets/[name][ext][query]",
          },
          {
            from: "skills-source/*.md",
            to: "skills/[name][ext][query]",
          },
          {
            from: "matters-source/*.csv",
            to: "data/[name][ext][query]",
          },
        ],
      }),
    ],
    devServer: {
      static: {
        directory: path.resolve(__dirname, "dist"),
      },
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      server: {
        type: "https",
        options: dev ? await devCerts.getHttpsServerOptions() : {},
      },
      port: 3000,
      // Same-origin API in dev so the session cookie set by /api/auth/google
      // sticks on localhost:3000 (the API otherwise runs on :3001).
      proxy: [
        {
          context: ["/api"],
          target: "https://localhost:3001",
          secure: false,
          changeOrigin: true,
        },
      ],
      // The web workspace is an SPA served from webapp.html at /login and
      // /app; serve that bundle for those client routes in dev.
      historyApiFallback: {
        rewrites: [
          { from: /^\/app(\/.*)?$/, to: "/webapp.html" },
          { from: /^\/login(\/.*)?$/, to: "/webapp.html" },
        ],
      },
    },
  };

  return config;
};
