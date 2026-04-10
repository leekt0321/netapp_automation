# netapp_automation

## Run

```bash
bash deploy/run.sh
```

`deploy/run.sh` will create `.venv`, install dependencies, create `.env` from `deploy/.env.example`, prepare runtime directories, and start the app.

## Release package

Create a versioned deployable archive like this:

```bash
bash deploy/build_release.sh 0.2v 0.2v
```

It generates:

- `dist/netapp_automation-0.2v/`
- `dist/netapp_automation-0.2v.tar.gz`

On another server:

```bash
tar -xzf netapp_automation-0.2v.tar.gz
cd netapp_automation-0.2v
bash deploy/run.sh
```

You can package older versions the same way:

```bash
bash deploy/build_release.sh 0.1v 0.1v
```

## Version usage

- `0.1v`: previous stable snapshot
- `0.2v`: current LMS-style backend structure
- future versions can be packaged with the same release script
