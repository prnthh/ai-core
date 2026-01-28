list of configs/models:
https://github.com/mlc-ai/web-llm/blob/main/src/config.ts

## for config (1b):
```
const ORIGIN = self.location.origin; // http://localhost:5173

const myAppConfig: webllm.AppConfig = {
    model_list: [{
        model_id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        model: `${ORIGIN}/models/Llama-3.2-1B-Instruct-q4f16_1-MLC`,
        model_lib: `${ORIGIN}/models/Llama-3.2-1B-Instruct-q4f16_1-MLC/Llama-3.2-1B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm`,
        required_features: ["shader-f16"],
        low_resource_required: true,
    }],
};
```

## get local model files
```
mkdir /public/models/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main/ (model files here)
mkdir /public/models/Llama-3.2-1B-Instruct-q4f16_1-MLC/(model lib here)

git clone https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC
```
get all the model files, put inside /public/models/Llama-3.2-1B-Instruct-q4f16_1-MLC/resolve/main 
https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC/tree/main

get lib from, put inside /public/models/Llama-3.2-1B-Instruct-q4f16_1-MLC/
https://github.com/mlc-ai/binary-mlc-llm-libs/blob/main/web-llm-models/v0_2_80/Llama-3.2-1B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm
