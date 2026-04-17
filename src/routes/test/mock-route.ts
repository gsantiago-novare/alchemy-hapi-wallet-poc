import { ServerRoute } from "@hapi/hapi";
import MockController from "../../controller/test/mock-controller";

const MockRouter: ServerRoute[] = [
  {
    method: "GET",
    path: "/test",
    handler: MockController.mockCall,
  },
];

export default MockRouter;