import Hapi from "@hapi/hapi";
import MockRouter from "./routes/test/index";
import { AuthenticationRouter } from "./routes/auth/index"; 
import { TransactionRouter } from "./routes/transaction/index";

const init = async () => {
  const server = Hapi.server({
    port: 3003,
    host: "localhost",
  });

  server.ext("onPreResponse", (request, h) => {
    const response = request.response;

    if (response && typeof response === "object" && "isBoom" in response && response.isBoom) {
      return h.response({
        success: false,
        statusCode: (response as any).output.statusCode,
        message: (response as any).output.payload.message,
      }).code((response as any).output.statusCode);
    }

    return h.continue;
  });

  server.route({
    method: "GET",
    path: "/hapi/test",
    handler: (request, h) => {
      console.log("Server is running");
      return h.response("<p>hapi.js test route</p>").type("text/html");
    },
  });

  await server.register([
    // {
    //   plugin: MockRouter,
    //   routes: { prefix: "/hapi/mock" },
    // },
    {
      plugin: AuthenticationRouter,
      routes: { prefix: "/hapi/authentication" },
    },
    {
      plugin: TransactionRouter,
      routes: { prefix: "/hapi/transaction" },
    },
  ]);

  await server.start();
  console.log(`Server running on %s`, server.info.uri);
};

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});

init();
