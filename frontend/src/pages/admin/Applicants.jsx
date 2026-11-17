import DocumentPolicyEditor from '../../components/applications/DocumentPolicyEditor'
import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Empty, LoadState, Modal, useApi } from "../../components/common/UI";
import ApplicationTable from "../../components/applications/ApplicationTable";
import { date } from "../../utils/format";
function ApplicantDetails({ id, close }) {
  const result = useApi(`/admin/applicants/${id}`),
    data = result.data;
  return (
    <Modal title="Applicant details" onClose={close}>
      <LoadState {...result} retry={result.refresh} />
      {data && (
        <>
          <dl className="detail-grid padded">
            {[
              ["Name", data.user.name],
              ["Email", data.user.email],
              ["Phone", data.user.phone],
              ["Address", data.user.address],
              ["Joined", date(data.user.createdAt)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <DocumentPolicyEditor applicantId={data.user._id} />
          <ApplicationTable items={data.applications} admin />
        </>
      )}
    </Modal>
  );
}
export default function Applicants() {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(null),
    result = useApi(
      `/admin/applicants?page=${page}&search=${encodeURIComponent(query)}`,
    ),
    data = result.data;
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">YOUR APPLICANT COMMUNITY</span>
          <h1>People. Possibilities.</h1>
          <p>A complete view of the people behind each application.</p>
        </div>
      </div>
      <section className="panel">
        <div className="filters">
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Search applicants"
              placeholder="Search by name or email…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <LoadState {...result} retry={result.refresh} />
        {!result.loading &&
          !result.error &&
          (data.items.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>APPLICANT</th>
                      <th>PHONE</th>
                      <th>JOINED</th>
                      <th>APPLICATIONS</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((u) => (
                      <tr key={u._id}>
                        <td>
                          <strong>{u.name}</strong>
                          <small className="table-sub">{u.email}</small>
                        </td>
                        <td>{u.phone || "—"}</td>
                        <td>{date(u.createdAt)}</td>
                        <td>{u.totalApplications}</td>
                        <td>
                          <button
                            className="icon-btn"
                            aria-label={`View ${u.name}`}
                            onClick={() => setSelected(u._id)}
                          >
                            <ArrowUpRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>{data.total} applicants</span>
                <button
                  className="btn secondary"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span>
                  {page} / {data.pages}
                </span>
                <button
                  className="btn secondary"
                  disabled={page >= data.pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <Empty title="No applicants found">
              Registered applicants will appear here.
            </Empty>
          ))}
      </section>
      {selected && (
        <ApplicantDetails id={selected} close={() => setSelected(null)} />
      )}
    </>
  );
}
