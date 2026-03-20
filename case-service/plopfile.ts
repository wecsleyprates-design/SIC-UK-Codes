// plopfile.ts
import type { NodePlopAPI } from 'plop';

export default function (plop: NodePlopAPI) {
    // controller generator
    plop.setGenerator('module', {
        description: 'Create a new module',
        prompts: [{
            type: 'input',
            name: 'name',
            message: `Please enter module name
Example

test-module
testmodule
: `
        }],
        actions: () => {
            const actionsArray: any = [
                {
                    path: 'src/api/v1/modules/{{kebabCase name}}/controller.ts',
                    templateFile: '.templates/module/controller.ts.hbs',
                },
                {
                    path: 'src/api/v1/modules/{{kebabCase name}}/error.ts',
                    templateFile: '.templates/module/error.ts.hbs',
                },
                {
                    path: 'src/api/v1/modules/{{kebabCase name}}/routes.ts',
                    templateFile: '.templates/module/routes.ts.hbs',
                },
                {
                    path: 'src/api/v1/modules/{{kebabCase name}}/repository.ts',
                    templateFile: '.templates/module/repository.ts.hbs',
                },
                {
                    path: 'src/api/v1/modules/{{kebabCase name}}/schema.ts',
                    templateFile: '.templates/module/schema.ts.hbs',
                },
                {
                    path: 'src/api/v1/modules/{{kebabCase name}}/types.ts',
                    templateFile: '.templates/module/types.ts.hbs',
                },
                {
                    path: 'src/api/v1/modules/{{kebabCase name}}/__tests__/{{kebabCase name}}.spec.ts',
                    templateFile: '.templates/module/__tests__/service.spec.ts.hbs',
                },
                {
                    path: 'src/api/v1/modules/{{kebabCase name}}/{{kebabCase name}}.ts',
                    templateFile: '.templates/module/service.ts.hbs',
                },
            ]

            actionsArray.forEach(action => {
                action.type = 'add';
                action.skipIfExists = true;
            })

            actionsArray.push({
                type: "append",
                path: "src/api/v1/index.js",
                pattern: "import { Router } from \"express\";",
                template: "import {{camelCase name}}Routes from \"./modules/{{kebabCase name}}/routes\";"
            });
            actionsArray.push({
                type: "append",
                path: "src/api/v1/index.js",
                pattern: "Routes);",
                template: "router.use({{camelCase name}}Routes);"
            });
            return actionsArray;
        }
    });
};