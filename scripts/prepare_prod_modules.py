import os
import shutil
import json

def prepare_prod_modules():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    node_modules_src = os.path.join(base_dir, "node_modules")
    prod_dir = os.path.join(base_dir, "dist_resources", "node_modules")
    
    # 1. Clean previous dist_resources
    if os.path.exists(os.path.dirname(prod_dir)):
        shutil.rmtree(os.path.dirname(prod_dir))
    
    os.makedirs(prod_dir)
    
    # 2. List of top-level modules to copy
    # These are marked as externals in Webpack
    modules_to_copy = [
        "opencode-ai", # CLI embebido de OpenCode (binario nativo ya resuelto por su propio postinstall)
        "better-sqlite3",
        "@lydell", # contains node-pty
        "web-tree-sitter",
        "tree-sitter-bash",
        "bcryptjs",
        "bindings",
        "prebuild-install",
        "node-gyp-build",
        "detect-libc",
        "expand-template",
        "github-from-package",
        "minimist",
        "mkdirp-classic",
        "napi-build-utils",
        "node-abi",
        "pump",
        "rc",
        "simple-get",
        "tar-fs",
        "tunnel-agent",
        "@mapbox", # Sub-dependency of some native modules if it exists
        "decompress-response", # dependency of simple-get
        "once", # dependency of simple-get
        "mimic-response", # dependency of decompress-response
        "file-uri-to-path", # CRITICAL: dependency of bindings
    ]
    
    print(f"Preparing production node_modules in {prod_dir}...")
    
    for module in modules_to_copy:
        src = os.path.join(node_modules_src, module)
        dst = os.path.join(prod_dir, module)
        
        if os.path.exists(src):
            print(f"Copying {module}...")
            # For @lydell and other scopes, we might need to create the directory
            if module.startswith("@"):
                os.makedirs(os.path.dirname(dst), exist_ok=True)
            
            if os.path.isdir(src):
                shutil.copytree(src, dst, dirs_exist_ok=True, ignore=shutil.ignore_patterns('node_modules'))
            else:
                shutil.copy2(src, dst)
        else:
            print(f"Warning: {module} not found in node_modules, skipping.")

    print("Successfully prepared production node_modules.")

if __name__ == "__main__":
    prepare_prod_modules()
