# netapp_automation

## Run

```bash
bash deploy/run.sh
```

`deploy/run.sh` will create `.venv`, install dependencies, create `.env` from `deploy/.env.example`, prepare runtime directories, and start the app.

If a release package contains `vendor/`, the app will use bundled dependencies first, so another server can run it without downloading packages from the internet. The target server still needs a compatible `python3`.

## Release package

Create a versioned deployable archive like this:

```bash
bash deploy/build_release.sh 0.4v 0.4v
```

It generates:

- `dist/netapp_automation-0.4v/`
- `dist/netapp_automation-0.4v.tar.gz`

On another server:

```bash
tar -xzf netapp_automation-0.4v.tar.gz
cd netapp_automation-0.4v
bash deploy/run.sh
```

You can package older versions the same way:

```bash
bash deploy/build_release.sh 0.1v 0.1v
```

Release packages now include:

- project source at that version
- `deploy/run.sh`
- `deploy/.env.example`
- `requirements.txt`
- bundled `vendor/` dependencies from the current environment

## Version usage

- `0.1v`: previous stable snapshot
- `0.4v`: current PostgreSQL-based working snapshot
- future versions can be packaged with the same release script
